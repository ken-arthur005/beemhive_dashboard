import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHarness, ids } from './database-harness.js'

let db
beforeAll(async () => { db = await createHarness(process.env.TEST_DATABASE_URL) }, 60000)
afterAll(async () => { if (db) await db.close() }, 30000)

describe('baseline preservation and permissions', () => {
  it('preserves all 9 users, 8 profiles, 6 slugs and 4 objects; only initializes customer state', async () => {
    expect((await db.pool.query('SELECT count(*)::int AS n FROM auth.users')).rows[0].n).toBe(9)
    const profiles = (await db.pool.query('SELECT * FROM public.profiles ORDER BY user_id')).rows
    expect(profiles).toHaveLength(8)
    for (const old of db.preserved) {
      const current = profiles.find(p => p.user_id === old.user_id)
      for (const key of Object.keys(old)) expect(current[key]).toEqual(old[key])
      expect(current.revision).toBe('0')
    }
    const accounts = (await db.pool.query('SELECT * FROM public.customer_accounts')).rows
    expect(accounts).toHaveLength(6)
    for (const account of accounts) expect(account).toMatchObject({ status: 'active', setup_completed_at: null, published_revision: null })
    expect((await db.pool.query('SELECT count(*)::int AS n FROM public.profile_publications')).rows[0].n).toBe(0)
    expect((await db.pool.query('SELECT slug,current_assignment_id FROM public.nfc_items ORDER BY slug')).rows.map(i => i.slug))
      .toEqual(Array.from({ length: 6 }, (_, i) => `legacy-${i}`))
    expect((await db.pool.query('SELECT * FROM public.nfc_assignments')).rows).toHaveLength(6)
    expect((await db.pool.query('SELECT * FROM public.profile_media')).rows).toHaveLength(3)
    expect((await db.pool.query('SELECT content_type,byte_size,is_legacy FROM public.profile_media WHERE owner_id=$1', [ids.customers[2]])).rows[0])
      .toEqual({ content_type: 'application/octet-stream', byte_size: '7340032', is_legacy: true })
    expect((await db.pool.query('SELECT * FROM storage.objects')).rows).toHaveLength(4)
    expect((await db.pool.query("SELECT public FROM storage.buckets WHERE id='profile-photos'")).rows[0].public).toBe(true)
    expect(await db.rpc('resolve_public_profile', ['legacy-0'])).toBeNull()
  })

  it('makes every lifecycle RPC service-only and forbids direct browser authoritative writes', async () => {
    const functions = (await db.pool.query(`SELECT p.oid::regprocedure::text AS signature,p.prosecdef,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname<>'is_admin'`)).rows
    expect(functions.length).toBeGreaterThanOrEqual(12)
    for (const fn of functions) expect(fn).toMatchObject({ prosecdef: false, anon: false, authenticated: false, service: true })
    await expect(db.asRole('anon', null, 'SELECT public.resolve_public_profile($1)', ['legacy-0'])).rejects.toMatchObject({ code: '42501' })
    await expect(db.asRole('authenticated', ids.customers[0], 'SELECT public.publish_profile($1,0)', [ids.customers[0]])).rejects.toMatchObject({ code: '42501' })
    for (const role of ['anon', 'authenticated']) {
      await expect(db.asRole(role, ids.customers[0], 'UPDATE public.profiles SET revision=99 WHERE user_id=$1', [ids.customers[0]])).rejects.toMatchObject({ code: '42501' })
      await expect(db.asRole(role, ids.customers[0], 'UPDATE public.customer_accounts SET setup_completed_at=now()')).rejects.toMatchObject({ code: '42501' })
      await expect(db.asRole(role, ids.customers[0], "INSERT INTO public.users_roles(user_id,role) VALUES($1,'admin')", [randomUUID()])).rejects.toMatchObject({ code: '42501' })
      await expect(db.asRole(role, ids.customers[0], 'SELECT * FROM public.setup_grants')).rejects.toMatchObject({ code: '42501' })
    }
    await expect(db.asRole('anon', null, 'SELECT public.is_admin()')).rejects.toMatchObject({ code: '42501' })
    expect((await db.asRole('authenticated', ids.admin, 'SELECT public.is_admin() AS admin')).rows[0].admin).toBe(true)
    expect((await db.asRole('authenticated', ids.customers[0], 'SELECT public.is_admin() AS admin')).rows[0].admin).toBe(false)
    expect((await db.asRole('authenticated', ids.customers[0], 'SELECT * FROM public.users_roles')).rows).toHaveLength(1)
  })
})

describe('revision and publication', () => {
  it('preserves ensure_customer state and rejects admin conflicts', async () => {
    await db.rpc('ensure_customer', [ids.customers[0], 'Do not overwrite'])
    expect((await db.pool.query('SELECT name FROM public.profiles WHERE user_id=$1', [ids.customers[0]])).rows[0].name).toBe('Original 3')
    await expect(db.rpc('ensure_customer', [ids.admin, 'Customer'])).rejects.toMatchObject({ code: '23505' })
  })

  it('allows exactly one concurrent CAS save and rejects unsafe content or another owner photo', async () => {
    const c = await db.customer()
    const attempts = await Promise.allSettled([
      db.rpc('save_profile_draft', [c.user, c.revision, { ...c.draft, name: 'Winner A' }]),
      db.rpc('save_profile_draft', [c.user, c.revision, { ...c.draft, name: 'Winner B' }]),
    ])
    expect(attempts.filter(a => a.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.find(a => a.status === 'rejected').reason.code).toBe('40001')
    const media = (await db.pool.query('SELECT id FROM public.profile_media LIMIT 1')).rows[0].id
    await expect(db.service('UPDATE public.profile_media SET object_path=$1 WHERE id=$2', [`${c.user}/replace.jpg`, media]))
      .rejects.toMatchObject({ code: '42501' })
    await expect(db.pool.query("UPDATE public.profile_media SET content_type='text/html' WHERE id=$1", [media]))
      .rejects.toMatchObject({ code: '23514' })
    await expect(db.service(`INSERT INTO public.profile_media(owner_id,object_path,content_type,byte_size)
      VALUES($1,$2,'image/jpeg',7340032)`, [c.user, `${c.user}/oversize.jpg`])).rejects.toMatchObject({ code: '23514' })
    await expect(db.rpc('save_profile_draft', [c.user, 2, { ...c.draft, photo_asset_id: media }])).rejects.toMatchObject({ code: '42501' })
    await expect(db.rpc('save_profile_draft', [c.user, 2, { ...c.draft, links: [{ type: 'website', url: 'javascript:alert(1)' }] }])).rejects.toMatchObject({ code: '22023' })
    await expect(db.rpc('save_profile_draft', [c.user, 2, { ...c.draft, published_revision: 2 }])).rejects.toMatchObject({ code: '22023' })
    await expect(db.rpc('save_profile_draft', [c.user, 2, { ...c.draft, background: 'url(https://tracker.test)' }])).rejects.toMatchObject({ code: '22023' })
  })

  it('requires setup, acknowledges an exact revision, retains immutable snapshots and enforces publication RLS', async () => {
    const c = await db.customer({ setup: false, publish: false })
    const i = await db.item(c.user)
    await expect(db.rpc('publish_profile', [c.user, c.revision])).rejects.toMatchObject({ code: '42501' })
    await db.service('UPDATE public.customer_accounts SET setup_completed_at=now() WHERE user_id=$1', [c.user])
    const first = await db.rpc('publish_profile', [c.user, c.revision])
    expect(await db.rpc('publish_profile', [c.user, c.revision])).toEqual(first)
    await db.rpc('save_profile_draft', [c.user, c.revision, { ...c.draft, name: 'New draft' }])
    expect((await db.rpc('resolve_public_profile', [i.slug])).content.name).toBe(c.draft.name)
    await expect(db.rpc('publish_profile', [c.user, c.revision])).rejects.toMatchObject({ code: '40001' })
    const second = await db.rpc('publish_profile', [c.user, 2])
    expect(second.content.name).toBe('New draft')
    await expect(db.service("UPDATE public.profile_publications SET content='{}' WHERE user_id=$1", [c.user])).rejects.toMatchObject({ code: '42501' })
    await expect(db.pool.query("UPDATE public.profile_publications SET content='{}' WHERE user_id=$1", [c.user])).rejects.toMatchObject({ code: '23514' })
    await expect(db.asRole('anon', null, 'SELECT * FROM public.profile_publications')).rejects.toMatchObject({ code: '42501' })
    expect((await db.asRole('authenticated', c.user, 'SELECT * FROM public.profile_publications')).rows).toHaveLength(2)
    expect((await db.asRole('authenticated', ids.customers[5], 'SELECT * FROM public.profile_publications WHERE user_id=$1', [c.user])).rows).toHaveLength(0)
    await db.rpc('unpublish_profile', [c.user])
    expect(await db.rpc('resolve_public_profile', [i.slug])).toBeNull()
    expect((await db.pool.query('SELECT * FROM public.profile_publications WHERE user_id=$1', [c.user])).rows).toHaveLength(2)
  })
})

describe('items, transfers and event serialization', () => {
  it('creates idempotently, checks original operation payload and rejects nonadmins', async () => {
    const c = await db.customer()
    const key = randomUUID()
    const slug = `idem-${randomUUID()}`
    const i = await db.item(c.user, slug, key, 'round_tag')
    expect(await db.item(c.user, slug, key, 'round_tag')).toEqual(i)
    await expect(db.item(c.user, `${slug}-other`, key)).rejects.toMatchObject({ code: '23505' })
    await expect(db.rpc('create_nfc_item', [c.user, c.user, `denied-${randomUUID()}`, 'card', randomUUID()])).rejects.toMatchObject({ code: '42501' })
    const counts = (await db.pool.query('SELECT count(*)::int AS n FROM public.nfc_assignments WHERE nfc_item_id=$1', [i.id])).rows[0].n
    expect(counts).toBe(1)
  })

  it('atomically deduplicates concurrent views, allows separate contacts and uses a sliding window', async () => {
    const c = await db.customer()
    const i = await db.item(c.user)
    const args = [i.slug, 'profile_view', 'hash-concurrent', 'mobile', 'https://example.test/']
    const results = await Promise.all(Array.from({ length: 12 }, () => db.rpc('record_profile_event', args)))
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await db.rpc('record_profile_event', [i.slug, 'contact_download', 'hash-concurrent', 'mobile', null])).toBe(true)
    expect(await db.rpc('record_profile_event', [i.slug, 'contact_download', 'hash-concurrent', 'mobile', null])).toBe(true)
    await db.service("UPDATE public.tap_events SET created_at=clock_timestamp()-interval '6 minutes' WHERE nfc_item_id=$1 AND event_type='profile_view'", [i.id])
    expect(await db.rpc('record_profile_event', args)).toBe(true)
    const noContact = await db.customer({ contact: false })
    const paused = await db.item(noContact.user)
    expect(await db.rpc('record_profile_event', [paused.slug, 'contact_download', 'hash', 'desktop', null])).toBe(false)
    await db.rpc('manage_nfc_item', [ids.admin, paused.id, 'deactivate', paused.version, null, ''])
    expect(await db.rpc('record_profile_event', [paused.slug, 'profile_view', 'hash', 'desktop', null])).toBe(false)
  })

  it('allows one of two concurrent transfers, pauses exposure and keeps assignment-owned history', async () => {
    const old = await db.customer()
    const next = await db.customer()
    const other = await db.customer()
    const i = await db.item(old.user)
    await db.rpc('record_profile_event', [i.slug, 'profile_view', 'same-hash', 'mobile', null])
    const results = await Promise.allSettled([
      db.rpc('manage_nfc_item', [ids.admin, i.id, 'transfer', i.version, next.user, 'Transfer A']),
      db.rpc('manage_nfc_item', [ids.admin, i.id, 'transfer', i.version, other.user, 'Transfer B']),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(r => r.status === 'rejected').reason.code).toBe('40001')
    const moved = results.find(r => r.status === 'fulfilled').value
    expect(moved).toMatchObject({ slug: i.slug, is_active: false, version: 1 })
    expect(await db.rpc('resolve_public_profile', [i.slug])).toBeNull()
    await db.rpc('manage_nfc_item', [ids.admin, i.id, 'activate', moved.version, null, ''])
    expect(await db.rpc('record_profile_event', [i.slug, 'profile_view', 'same-hash', 'desktop', null])).toBe(true)
    const assignments = (await db.pool.query('SELECT * FROM public.nfc_assignments WHERE nfc_item_id=$1 ORDER BY started_at', [i.id])).rows
    expect(assignments).toHaveLength(2)
    expect(assignments.filter(a => a.ended_at === null)).toHaveLength(1)
    expect(assignments[0].ended_at).toEqual(assignments[1].started_at)
    const oldEvents = (await db.asRole('authenticated', old.user, 'SELECT * FROM public.tap_events WHERE nfc_item_id=$1', [i.id])).rows
    const newEvents = (await db.asRole('authenticated', moved.owner_id, 'SELECT * FROM public.tap_events WHERE nfc_item_id=$1', [i.id])).rows
    expect(oldEvents).toHaveLength(1)
    expect(newEvents).toHaveLength(1)
    expect(oldEvents[0].assignment_id).not.toBe(newEvents[0].assignment_id)
    expect((await db.rpc('analytics_summary', [old.user, null, i.id])).totalTaps).toBe(1)
    expect((await db.rpc('analytics_summary', [moved.owner_id, null, i.id])).totalTaps).toBe(1)
  })

  it('serializes a held event transaction against transfer without reassignment or deadlock', async () => {
    const old = await db.customer()
    const next = await db.customer()
    const i = await db.item(old.user)
    const client = await db.pool.connect()
    let transfer
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE service_role')
      await client.query("SELECT public.record_profile_event($1,'profile_view','held','mobile',null)", [i.slug])
      transfer = db.rpc('manage_nfc_item', [ids.admin, i.id, 'transfer', 0, next.user, ''])
      await client.query('COMMIT')
      await transfer
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
    const events = (await db.pool.query(`SELECT a.owner_id FROM public.tap_events e
      JOIN public.nfc_assignments a ON a.id=e.assignment_id WHERE e.nfc_item_id=$1`, [i.id])).rows
    expect(events).toEqual([{ owner_id: old.user }])
  })

  it('requires an eligible owner for reactivation, preserves slug after retirement and rejects mismatched event assignments', async () => {
    const c = await db.customer({ setup: false, publish: false })
    const other = await db.customer()
    const i = await db.item(c.user)
    const unrelated = await db.item(other.user)
    const paused = await db.rpc('manage_nfc_item', [ids.admin, i.id, 'deactivate', i.version, null, ''])
    await expect(db.rpc('manage_nfc_item', [ids.admin, i.id, 'activate', paused.version, null, ''])).rejects.toMatchObject({ code: '42501' })
    await expect(db.service(`INSERT INTO public.tap_events(nfc_item_id,assignment_id,device_type)
      VALUES($1,$2,'mobile')`, [i.id, unrelated.current_assignment_id])).rejects.toMatchObject({ code: '23503' })
    const retired = await db.rpc('manage_nfc_item', [ids.admin, i.id, 'retire', paused.version, null, 'End of life'])
    expect(retired).toMatchObject({ slug: i.slug, is_active: false, current_assignment_id: null })
    expect(retired.retired_at).not.toBeNull()
    await expect(db.rpc('manage_nfc_item', [ids.admin, i.id, 'activate', retired.version, null, ''])).rejects.toMatchObject({ code: '23514' })
    await expect(db.item(other.user, i.slug)).rejects.toMatchObject({ code: '23505' })
  })
})

describe('suspension and resumable deletion', () => {
  it('blocks suspended exposure and writes, rejects admin targets, and restores an active account gate', async () => {
    const c = await db.customer()
    const i = await db.item(c.user)
    await expect(db.rpc('set_customer_status', [ids.admin, ids.admin, 'suspended', ''])).rejects.toMatchObject({ code: '42501' })
    await db.rpc('set_customer_status', [ids.admin, c.user, 'suspended', 'Review'])
    expect(await db.rpc('resolve_public_profile', [i.slug])).toBeNull()
    expect(await db.rpc('record_profile_event', [i.slug, 'profile_view', 'h', 'mobile', null])).toBe(false)
    await expect(db.rpc('save_profile_draft', [c.user, c.revision, c.draft])).rejects.toMatchObject({ code: '42501' })
    await expect(db.rpc('publish_profile', [c.user, c.revision])).rejects.toMatchObject({ code: '42501' })
    await expect(db.rpc('manage_nfc_item', [ids.admin, i.id, 'activate', i.version, null, ''])).rejects.toMatchObject({ code: '42501' })
    await db.rpc('set_customer_status', [ids.admin, c.user, 'active', 'Restored'])
    expect(await db.rpc('resolve_public_profile', [i.slug])).not.toBeNull()
  })

  it('returns the same deletion job, retires items, anonymizes history and verifies/redacts cleanup', async () => {
    const c = await db.customer()
    const i = await db.item(c.user)
    await db.pool.query(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('profile-photos',$1,'{}')`, [`${c.user}/private.jpg`])
    await db.rpc('record_profile_event', [i.slug, 'profile_view', 'erase-hash', 'mobile', 'https://private.test/'])
    const job = await db.rpc('begin_customer_deletion', [ids.admin, c.user])
    expect(await db.rpc('begin_customer_deletion', [ids.admin, c.user])).toEqual(job)
    expect(job.object_inventory).toEqual([{ bucket: 'profile-photos', object_path: `${c.user}/private.jpg` }])
    const retired = (await db.pool.query('SELECT * FROM public.nfc_items WHERE id=$1', [i.id])).rows[0]
    expect(retired).toMatchObject({ owner_id: null, is_active: false, current_assignment_id: null })
    expect(retired.retired_at).not.toBeNull()
    expect(await db.rpc('resolve_public_profile', [i.slug])).toBeNull()
    expect((await db.pool.query('SELECT ip_hash,referrer FROM public.tap_events WHERE nfc_item_id=$1', [i.id])).rows).toEqual([{ ip_hash: null, referrer: null }])
    await expect(db.rpc('finish_customer_deletion', [ids.admin, job.id])).rejects.toMatchObject({ code: '23514' })
    await expect(db.rpc('set_customer_status', [ids.admin, c.user, 'active', ''])).rejects.toMatchObject({ code: '42501' })
    // Local Auth/Storage API stubs: delete externally, then finish the job.
    await db.pool.query('DELETE FROM auth.users WHERE id=$1', [c.user])
    await expect(db.rpc('finish_customer_deletion', [ids.admin, job.id])).rejects.toMatchObject({ code: '23514' })
    await db.pool.query("DELETE FROM storage.objects WHERE bucket_id='profile-photos' AND name=$1", [`${c.user}/private.jpg`])
    await db.rpc('finish_customer_deletion', [ids.admin, job.id])
    await db.rpc('finish_customer_deletion', [ids.admin, job.id])
    expect((await db.pool.query('SELECT * FROM public.customer_deletions WHERE id=$1', [job.id])).rows[0])
      .toMatchObject({ target_user_id: null, object_inventory: [], status: 'completed', last_error: null })
    expect((await db.pool.query('SELECT owner_id FROM public.nfc_assignments WHERE nfc_item_id=$1', [i.id])).rows).toEqual([{ owner_id: null }])
    expect((await db.pool.query("SELECT * FROM storage.objects WHERE name='unmatched-object.jpg'")).rows).toHaveLength(1)
    expect((await db.pool.query('SELECT * FROM public.tap_events WHERE nfc_item_id=$1', [i.id])).rows).toHaveLength(1)
  })

  it('deletes a former owner without retiring a transferred card or anonymizing the new owner history', async () => {
    const old = await db.customer()
    const next = await db.customer()
    const i = await db.item(old.user)
    await db.rpc('record_profile_event', [i.slug, 'profile_view', 'former-owner', 'mobile', 'https://old.test/'])
    const moved = await db.rpc('manage_nfc_item', [ids.admin, i.id, 'transfer', 0, next.user, ''])
    await db.rpc('manage_nfc_item', [ids.admin, i.id, 'activate', moved.version, null, ''])
    await db.rpc('record_profile_event', [i.slug, 'profile_view', 'current-owner', 'desktop', 'https://new.test/'])
    const job = await db.rpc('begin_customer_deletion', [ids.admin, old.user])
    expect((await db.rpc('resolve_public_profile', [i.slug])).owner_id).toBe(next.user)
    const events = (await db.pool.query(`SELECT ip_hash,referrer FROM public.tap_events
      WHERE nfc_item_id=$1 ORDER BY id`, [i.id])).rows
    expect(events).toEqual([{ ip_hash: null, referrer: null }, { ip_hash: 'current-owner', referrer: 'https://new.test/' }])
    await db.pool.query('DELETE FROM auth.users WHERE id=$1', [old.user])
    await db.rpc('finish_customer_deletion', [ids.admin, job.id])
    expect((await db.rpc('analytics_summary', [next.user, null, i.id])).totalTaps).toBe(1)
    expect((await db.rpc('analytics_summary', [null, null, i.id])).totalTaps).toBe(2)
  })
})

describe('full SQL analytics and separate Storage cutover', () => {
  it('aggregates >1000 events, UTC calendar ranges, previous periods, devices and empty buckets', async () => {
    const c = await db.customer()
    const i = await db.item(c.user)
    // The session timezone is deliberately non-UTC; the result must remain UTC.
    await db.pool.query("SET TIME ZONE 'Pacific/Honolulu'")
    await db.service(`INSERT INTO public.tap_events(nfc_item_id,assignment_id,event_type,device_type,created_at)
      SELECT $1,$2,'profile_view',CASE WHEN n%2=0 THEN 'mobile' ELSE 'tablet' END,
        (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + interval '1 hour'
      FROM generate_series(1,1501) n`, [i.id, i.current_assignment_id])
    await db.service(`INSERT INTO public.tap_events(nfc_item_id,assignment_id,event_type,device_type,created_at)
      SELECT $1,$2,'profile_view','desktop',
        (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') - interval '7 days' + interval '1 hour'
      FROM generate_series(1,25)`, [i.id, i.current_assignment_id])
    await db.service(`INSERT INTO public.tap_events(nfc_item_id,assignment_id,event_type,device_type,created_at)
      VALUES($1,$2,'contact_download','unknown',date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`, [i.id, i.current_assignment_id])
    const stats = await db.rpc('analytics_summary', [c.user, 7, i.id])
    expect(stats).toMatchObject({ totalTaps: 1501, previousTaps: 25, todayTaps: 1501, contactDownloads: 1, allTimeTaps: 1526 })
    expect(stats.deviceTotals).toEqual({ mobile: 750, tablet: 751, desktop: 0, unknown: 0 })
    expect(stats.daily).toHaveLength(7)
    expect(stats.daily.slice(0, 6).every(d => d.taps === 0)).toBe(true)
    expect(stats.hourly).toHaveLength(24)
    expect(stats.hourly[1].taps).toBe(1501)
    expect(stats.cards[0]).toMatchObject({ tapCount: 1526, periodTapCount: 1501, today: 1501, contactDownloads: 1 })
    expect(stats.leaderboard).toEqual([])
    expect(stats.recentActivity).toEqual([])
    const all = await db.rpc('analytics_summary', [c.user, null, i.id])
    expect(all).toMatchObject({ totalTaps: 1526, previousTaps: 0 })
    const admin = await db.rpc('analytics_summary', [null, 7, i.id])
    expect(admin.leaderboard[0]).toMatchObject({ tap_count: 1526, period_taps: 1501, owner_id: c.user })
    expect(admin.recentActivity).toHaveLength(20)
    expect(admin.recentActivity.every(e => e.owner_id === c.user)).toBe(true)
    expect((await db.rpc('analytics_summary', [c.user, 30, i.id])).daily).toHaveLength(30)
    expect((await db.rpc('analytics_summary', [c.user, 90, i.id])).daily).toHaveLength(90)
    await expect(db.rpc('analytics_summary', [c.user, 1, i.id])).rejects.toMatchObject({ code: '22023' })
    const empty = await db.rpc('analytics_summary', [randomUUID(), 7, null])
    expect(empty).toMatchObject({ totalTaps: 0, lastTap: null, latestEvent: null, cards: [] })
  })

  it('cuts over only on explicit execution, retains all objects and defeats legacy permissive access', async () => {
    expect((await db.pool.query("SELECT public FROM storage.buckets WHERE id='profile-photos'")).rows[0].public).toBe(true)
    expect((await db.asRole('anon', null, "SELECT * FROM storage.objects WHERE bucket_id='profile-photos'")).rows).toHaveLength(4)
    await db.pool.query(await db.storageCutover())
    expect((await db.pool.query("SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='profile-photos'")).rows[0])
      .toEqual({ public: false, file_size_limit: '5242880', allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] })
    for (const role of ['anon', 'authenticated']) {
      expect((await db.asRole(role, ids.customers[0], "SELECT * FROM storage.objects WHERE bucket_id='profile-photos'")).rows).toHaveLength(0)
      await expect(db.asRole(role, ids.customers[0], "INSERT INTO storage.objects(bucket_id,name) VALUES('profile-photos',$1)", [`${ids.customers[0]}/direct.jpg`]))
        .rejects.toMatchObject({ code: '42501' })
    }
    expect((await db.service("SELECT * FROM storage.objects WHERE bucket_id='profile-photos'")).rows).toHaveLength(4)
  })
})
