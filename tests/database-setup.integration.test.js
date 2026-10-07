import { randomUUID, createHash } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createHarness, ids } from './database-harness.js'

let db
beforeAll(async () => { db = await createHarness(process.env.TEST_DATABASE_URL) }, 60000)
afterAll(async () => { if (db) await db.close() }, 30000)

async function grant(user) {
  const hash = createHash('sha256').update(randomUUID()).digest('hex')
  await db.service("INSERT INTO public.setup_grants(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'recovery',now()+interval '30 minutes')", [hash, user])
  return hash
}

test('setup is attested only after durable Auth success, and committed completion is retry-safe', async () => {
  const c = await db.customer({ setup: false, publish: false })
  const hash = await grant(c.user)
  const claim = randomUUID()
  const args = [hash, c.user, claim]
  expect(await db.rpc('claim_setup_grant', args)).toEqual({ state: 'ready' })
  await expect(db.rpc('complete_setup_grant', args)).rejects.toMatchObject({ code: '42501' })
  expect((await db.service('SELECT setup_completed_at FROM public.customer_accounts WHERE user_id=$1', [c.user])).rows[0].setup_completed_at).toBeNull()
  await db.rpc('mark_setup_password_updated', args)
  const retry = [hash, c.user, randomUUID()]
  expect(await db.rpc('claim_setup_grant', retry)).toEqual({ state: 'password_updated' })
  expect(await db.rpc('complete_setup_grant', retry)).toEqual({ success: true })
  expect(await db.rpc('complete_setup_grant', retry)).toEqual({ success: true })
  expect(await db.rpc('claim_setup_grant', [hash, c.user, randomUUID()])).toEqual({ state: 'completed' })
  expect((await db.service('SELECT setup_completed_at,published_revision FROM public.customer_accounts WHERE user_id=$1', [c.user])).rows[0])
    .toMatchObject({ setup_completed_at: expect.any(Date), published_revision: null })
})

test('two grants for one customer cannot race password updates', async () => {
  const c = await db.customer({ setup: false, publish: false })
  const hashes = await Promise.all([grant(c.user), grant(c.user)])
  const outcomes = await Promise.allSettled(hashes.map(hash => db.rpc('claim_setup_grant', [hash, c.user, randomUUID()])))
  expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1)
  expect(outcomes.find(outcome => outcome.status === 'rejected').reason.message).toContain('grant_busy')
})
test('admin recovery consumes its grant without creating a customer setup/publication record', async () => {
  const hash = await grant(ids.admin)
  const args = [hash, ids.admin, randomUUID()]
  expect(await db.rpc('claim_setup_grant', args)).toEqual({ state: 'ready' })
  await db.rpc('mark_setup_password_updated', args)
  expect(await db.rpc('complete_setup_grant', args)).toEqual({ success: true })
  expect(await db.rpc('claim_setup_grant', [hash, ids.admin, randomUUID()])).toEqual({ state: 'completed' })
  expect((await db.service('SELECT * FROM public.customer_accounts WHERE user_id=$1', [ids.admin])).rows).toHaveLength(0)
  const inviteHash = await grant(ids.admin)
  await db.service("UPDATE public.setup_grants SET purpose='invite' WHERE token_hash=$1", [inviteHash])
  await expect(db.rpc('claim_setup_grant', [inviteHash, ids.admin, randomUUID()])).rejects.toThrow('invalid_grant')
})

test('grants reject another identity, expiry and suspension; leases permit safe policy rejection', async () => {
  const c = await db.customer({ setup: false, publish: false })
  const other = await db.customer({ setup: false, publish: false })
  const hash = await grant(c.user)
  await expect(db.rpc('claim_setup_grant', [hash, other.user, randomUUID()])).rejects.toMatchObject({ code: '42501' })
  const claim = randomUUID()
  await db.rpc('claim_setup_grant', [hash, c.user, claim])
  await expect(db.rpc('release_setup_grant', [hash, c.user, randomUUID()])).rejects.toMatchObject({ code: '42501' })
  await db.rpc('release_setup_grant', [hash, c.user, claim])
  await db.rpc('claim_setup_grant', [hash, c.user, claim])
  await db.rpc('set_customer_status', [ids.admin, c.user, 'suspended', 'test'])
  await expect(db.rpc('mark_setup_password_updated', [hash, c.user, claim])).rejects.toThrow('account_inactive')
  await db.rpc('set_customer_status', [ids.admin, c.user, 'active', 'test'])
  await db.service("UPDATE public.setup_grants SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE token_hash=$1", [hash])
  await expect(db.rpc('claim_setup_grant', [hash, c.user, claim])).rejects.toThrow('grant_expired')
})

test('provisioning leases bind payload and block concurrent external invitations', async () => {
  const id = randomUUID()
  const args = [id, 'new@example.test', 'New customer', 'card', 'new-customer']
  expect((await db.rpc('claim_provisioning', args)).id).toBe(id)
  await expect(db.rpc('claim_provisioning', args)).rejects.toMatchObject({ code: '40001' })
  await expect(db.rpc('claim_provisioning', [id, 'other@example.test', 'New customer', 'card', 'new-customer'])).rejects.toMatchObject({ code: '23505' })
  await db.service("UPDATE public.provisioning_operations SET status='completed',lease_until=null WHERE id=$1", [id])
  expect((await db.rpc('claim_provisioning', args)).status).toBe('completed')
})

test('late uploads are fenced at registration and deletion retries refresh their inventory', async () => {
  const c = await db.customer()
  const op = randomUUID()
  await db.service("INSERT INTO public.provisioning_operations(id,email,customer_name,product_type,slug,user_id) VALUES($1,'personal@example.test','Personal name','card','personal-slug',$2)", [op, c.user])
  const item = await db.item(c.user)
  const job = await db.rpc('begin_customer_deletion', [ids.admin, c.user])
  expect(job.object_inventory).toEqual([])
  const path = `${c.user}/${randomUUID()}.jpg`
  await db.service("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('profile-photos',$1,'{\"mimetype\":\"image/jpeg\",\"size\":100}')", [path])
  await expect(db.rpc('register_profile_media', [c.user, randomUUID(), path, 100])).rejects.toMatchObject({ code: '42501' })
  const refreshed = await db.rpc('refresh_deletion_inventory', [ids.admin, job.id])
  expect(refreshed.object_inventory).toEqual([{ bucket: 'profile-photos', object_path: path }])
  expect((await db.service('SELECT email,customer_name FROM public.provisioning_operations WHERE id=$1', [op])).rows[0])
    .toEqual({ email: 'deleted@example.invalid', customer_name: 'Deleted customer' })
  await db.service("DELETE FROM storage.objects WHERE bucket_id='profile-photos' AND name=$1", [path])
  await db.service('DELETE FROM auth.users WHERE id=$1', [c.user])
  await db.rpc('finish_customer_deletion', [ids.admin, job.id])
  expect(await db.rpc('verify_customer_absent', [c.user])).toBe(true)
  expect((await db.service('SELECT slug,owner_id FROM public.nfc_items WHERE id=$1', [item.id])).rows[0]).toEqual({ slug: item.slug, owner_id: null })
})

test('physical slugs cannot be changed and public contact fetch respects published settings', async () => {
  const c = await db.customer({ contact: false })
  const item = await db.item(c.user)
  await expect(db.service("UPDATE public.nfc_items SET slug='changed-slug' WHERE id=$1", [item.id])).rejects.toMatchObject({ code: '23514' })
  expect(await db.rpc('fetch_public_profile', [item.slug, 'contact_download', 'hash', 'mobile', null])).toBeNull()
  expect((await db.rpc('fetch_public_profile', [item.slug, 'profile_view', 'hash', 'mobile', null])).content.name).toBe('Test customer')
  await expect(db.asRole('authenticated', c.user, 'SELECT public.claim_setup_grant($1,$2,$3)', ['0'.repeat(64), c.user, randomUUID()])).rejects.toMatchObject({ code: '42501' })
})
