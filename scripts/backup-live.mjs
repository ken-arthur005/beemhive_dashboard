import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
if (url !== 'https://muodxpvhjdvokpjmpgab.supabase.co' || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Expected Beem Hive credentials are required')
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const directory = path.resolve('.local-backups', new Date().toISOString().replace(/[:.]/g, '-'))
await mkdir(path.join(directory, 'objects'), { recursive: true, mode: 0o700 })
const check = result => { if (result.error) throw result.error; return result.data }
const tables = {}
for (const table of ['users_roles', 'profiles', 'nfc_items', 'tap_events']) {
  tables[table] = []
  for (let offset = 0; ;) {
    const rows = check(await db.from(table).select('*').range(offset, offset + 999))
    if (!rows.length) break
    tables[table].push(...rows)
    offset += rows.length
  }
}
const users = []
for (let page = 1; ;) {
  const data = check(await db.auth.admin.listUsers({ page, perPage: 1000 }))
  users.push(...data.users)
  if (!data.users.length || (Number.isFinite(data.total) && users.length >= data.total)) break
  page++
}
const buckets = check(await db.storage.listBuckets())
const objects = []
async function copyObjects(bucket, prefix = '') {
  for (let offset = 0; ;) {
    const rows = check(await db.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }))
    if (!rows.length) break
    offset += rows.length
    for (const row of rows) {
      const objectPath = prefix ? `${prefix}/${row.name}` : row.name
      if (!row.id) { await copyObjects(bucket, objectPath); continue }
      const blob = check(await db.storage.from(bucket).download(objectPath))
      const bytes = Buffer.from(await blob.arrayBuffer())
      const file = `${createHash('sha256').update(bucket + '\0' + objectPath).digest('hex')}.bin`
      await writeFile(path.join(directory, 'objects', file), bytes, { mode: 0o600 })
      objects.push({ bucket, objectPath, file, byteSize: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex'), metadata: row })
    }
  }
}
for (const bucket of buckets) await copyObjects(bucket.id)
await writeFile(path.join(directory, 'snapshot.json'), JSON.stringify({ capturedAt: new Date().toISOString(), project: 'muodxpvhjdvokpjmpgab', tables, users, buckets, objects }, null, 2), { mode: 0o600 })
console.log(JSON.stringify({ backupDirectory: directory, counts: { users: users.length, roles: tables.users_roles.length, profiles: tables.profiles.length, items: tables.nfc_items.length, events: tables.tap_events.length, objects: objects.length } }, null, 2))
// This recoverable application-data/media snapshot contains Auth directory
// metadata, not password hashes or a managed full-Postgres/PITR backup.
