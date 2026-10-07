import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = new URL('../', import.meta.url)
export const ids = {
  admin: '10000000-0000-0000-0000-000000000001',
  customers: Array.from({ length: 6 }, (_, i) => `20000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`),
}

export function localDatabaseUrl(value) {
  if (!value) throw new Error('TEST_DATABASE_URL is required: tests need isolated localhost Postgres')
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname) ||
      url.searchParams.has('host') || url.searchParams.has('hostaddr')) {
    throw new Error('Refusing database tests against any non-localhost or host-overridden URL')
  }
  // pg connection strings can carry libpq-style options; do not permit options
  // to redirect connections, configure unsafe settings, or hide hostname checks.
  for (const key of url.searchParams.keys()) {
    if (!['sslmode', 'application_name'].includes(key)) throw new Error(`Unsupported test connection option: ${key}`)
  }
  return url
}

export async function createHarness(value) {
  const url = localDatabaseUrl(value)
  const name = `beemhive_test_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Pool({ connectionString: url.toString(), max: 2 })
  let pool
  let created = false
  async function close() {
    if (pool) await pool.end()
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`)
    await admin.end()
  }
  try {
    await admin.query(`CREATE DATABASE "${name}"`)
    created = true
    url.pathname = `/${name}`
    pool = new pg.Pool({ connectionString: url.toString(), max: 16 })
    pool.on('error', () => { /* Cleanup may close idle clients after a failed transaction. */ })
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      END $$;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
      $$;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
        file_size_limit bigint, allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id text REFERENCES storage.buckets(id), name text NOT NULL, metadata jsonb, UNIQUE(bucket_id,name));
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users, storage.buckets, storage.objects TO service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
      CREATE POLICY legacy_storage_public ON storage.objects FOR ALL TO anon, authenticated USING(true) WITH CHECK(true);
    `)
    const migrations = (await readdir(new URL('supabase/migrations/', root))).filter(x => x.endsWith('.sql')).sort()
    const baseline = migrations.find(x => x.endsWith('_existing_database_baseline.sql'))
    const lifecycle = migrations.find(x => x.endsWith('_customer_nfc_lifecycle.sql'))
    if (!baseline || !lifecycle) throw new Error('Expected baseline and lifecycle migrations')
    const baselineSql = await readFile(new URL(`supabase/migrations/${baseline}`, root), 'utf8')
    await pool.query(baselineSql)
    const admins = [ids.admin, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003']
    for (const [i, user] of [...admins, ...ids.customers].entries()) {
      await pool.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [user, `baseline${i}@example.test`])
      await pool.query('INSERT INTO public.users_roles(user_id,role) VALUES($1,$2)', [user, i < 3 ? 'admin' : 'customer'])
      if (i !== 2) {
        await pool.query(`INSERT INTO public.profiles(user_id,name,title,bio,links,show_save_contact,background,photo_url)
          VALUES($1,$2,'Preserved title','Preserved bio','[]',true,'#000000',$3)`,
        [user, `Original ${i}`, i >= 3 && i < 6 ? `https://example.supabase.co/storage/v1/object/public/profile-photos/${user}/legacy.jpg` : null])
      }
    }
    for (const [i, owner] of ids.customers.entries()) {
      await pool.query(`INSERT INTO public.nfc_items(slug,product_type,owner_id) VALUES($1,$2,$3)`,
        [`legacy-${i}`, ['card', 'stand', 'round_tag'][i % 3], owner])
      if (i < 3) await pool.query(`INSERT INTO storage.objects(bucket_id,name,metadata)
        VALUES('profile-photos',$1,$2)`, [`${owner}/legacy.jpg`,
        i === 2 ? { size: 7340032 } : { mimetype: 'image/jpeg', size: 128 }])
    }
    await pool.query(`INSERT INTO storage.objects(bucket_id,name,metadata)
      VALUES('profile-photos','unmatched-object.jpg','{"mimetype":"image/png","size":64}')`)
    const preserved = (await pool.query('SELECT * FROM public.profiles ORDER BY user_id')).rows
    // Baseline replay must not replace existing content, policies, or bucket.
    await pool.query(baselineSql)
    await pool.query(await readFile(new URL(`supabase/migrations/${lifecycle}`, root), 'utf8'))
    for (const migration of migrations.filter(file => file !== baseline && file !== lifecycle)) {
      await pool.query(await readFile(new URL(`supabase/migrations/${migration}`, root), 'utf8'))
    }
    async function asRole(role, user, sql, params = []) {
      if (!['anon', 'authenticated', 'service_role'].includes(role)) throw new Error('Invalid test role')
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`SET LOCAL ROLE ${role}`)
        await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user || ''])
        const result = await client.query(sql, params)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally { client.release() }
    }
    const service = (sql, params) => asRole('service_role', null, sql, params)
    async function rpc(fn, params) {
      if (!/^[a-z_]+$/.test(fn)) throw new Error('Invalid function name')
      return (await service(`SELECT public.${fn}(${params.map((_, i) => `$${i + 1}`).join(',')}) AS result`, params)).rows[0].result
    }
    async function customer({ setup = true, publish = true, contact = true } = {}) {
      const user = randomUUID()
      await pool.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [user, `${user}@example.test`])
      await rpc('ensure_customer', [user, 'Test customer'])
      if (setup) await service('UPDATE public.customer_accounts SET setup_completed_at=now() WHERE user_id=$1', [user])
      const draft = { name: 'Test customer', title: 'Test title', bio: 'Test bio', links: [], show_save_contact: contact, background: '#000000', photo_asset_id: null }
      const profile = await rpc('save_profile_draft', [user, 0, draft])
      if (publish) await rpc('publish_profile', [user, profile.revision])
      return { user, draft, revision: profile.revision }
    }
    async function item(owner, slug = `test-${randomUUID()}`, operation = randomUUID(), type = 'card') {
      return rpc('create_nfc_item', [ids.admin, owner, slug, type, operation])
    }
    return { pool, rpc, service, asRole, customer, item, preserved, close,
      storageCutover: () => readFile(new URL('supabase/storage-cutover.sql', root), 'utf8'),
      databaseName: name, sourcePath: fileURLToPath(root) }
  } catch (error) {
    await close()
    throw error
  }
}
