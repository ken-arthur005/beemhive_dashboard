import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const origin = 'https://beemhive.vercel.app'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const checked = result => { if (result.error) throw result.error; return result.data }
const checks = []
const baseline = checked(await db.auth.admin.listUsers({ page: 1, perPage: 1000 })).users.map(user => user.id)
const actor = checked(await db.from('users_roles').select('user_id').eq('role', 'admin').limit(1).single()).user_id
const email = `beemhive-validation-${randomUUID()}@example.invalid`
const password = `${randomBytes(24).toString('base64url')}aA1!`
let userId
let browser
let cleanupError
try {
  const invitation = checked(await db.auth.admin.generateLink({ type: 'invite', email, options: { data: { full_name: 'Release validation' } } }))
  userId = invitation.user.id
  assert(!baseline.includes(userId))
  assert.equal(checked(await db.from('users_roles').select('role').eq('user_id', userId).maybeSingle()), null)
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  const confirmPost = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname === '/auth/confirm' && request.method() === 'POST') confirmPost.push(request.headers().origin)
  })
  const response = await page.goto(`${origin}/auth/confirm?${new URLSearchParams({ token_hash: invitation.properties.hashed_token, type: 'invite' })}`)
  assert.equal(response.status(), 200)
  assert.equal(response.headers()['referrer-policy'], 'strict-origin')
  await page.getByRole('button', { name: 'Continue to password setup' }).click()
  await page.waitForURL(url => url.pathname === '/invite', { timeout: 30000 })
  assert.equal(new URL(page.url()).searchParams.get('error'), null)
  assert.deepEqual(confirmPost, [origin])
  assert.equal(checked(await db.from('users_roles').select('role').eq('user_id', userId).single()).role, 'customer')
  checks.push('real native confirmation + automatic customer membership')

  await page.getByLabel('New password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  const setupResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/setup' && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Activate my account' }).click()
  assert.equal((await setupResponse).status(), 200)
  const account = checked(await db.from('customer_accounts').select('*').eq('user_id', userId).single())
  assert(account.setup_completed_at)
  assert.equal(account.published_revision, null)
  checks.push('real Auth password setup + trusted DB completion')

  const api = async (pathname, method = 'GET', body) => {
    const response = await page.request.fetch(origin + pathname, { method,
      headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { data: body } : {}) })
    return { status: response.status(), data: await response.json() }
  }
  const item = checked(await db.rpc('create_nfc_item', { p_actor: actor, p_owner: userId,
    p_slug: `validation-${randomUUID().slice(0, 12)}`, p_product_type: 'card', p_operation_key: randomUUID() }))
  const before = await fetch(`${origin}/t/${item.slug}`)
  assert((await before.text()).includes('This profile is not available'))
  const image = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#f59e0b' } }).png().toBuffer()
  const upload = await page.request.post(`${origin}/api/customer/media`, { headers: { Origin: origin },
    multipart: { file: { name: 'validation.png', mimeType: 'image/png', buffer: image } } })
  assert.equal(upload.status(), 201)
  const asset = (await upload.json()).asset
  assert.equal((await fetch(`${origin}/api/public/photo/${item.slug}`)).status, 404)
  const media = checked(await db.from('profile_media').select('object_path').eq('id', asset.id).single())
  assert((await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-photos/${media.object_path}`)).status >= 400)
  const draft = { name: 'Published validation', title: 'Test profile', bio: 'Disposable release test',
    links: [{ id: randomUUID(), type: 'website', url: 'https://example.com' }, { id: randomUUID(), type: 'phone', url: '+233123456789' }],
    show_save_contact: true, background: '#000000', photo_asset_id: asset.id }
  const saved = await api('/api/customer/profile', 'PUT', { expectedRevision: 0, draft })
  assert.equal(saved.status, 200)
  assert.equal((await api('/api/customer/profile/publish', 'POST', { revision: saved.data.profile.revision })).status, 200)
  assert((await (await fetch(`${origin}/t/${item.slug}`)).text()).includes('Published validation'))
  assert.equal((await fetch(`${origin}/api/public/photo/${item.slug}`)).status, 200)
  const card = await fetch(`${origin}/api/vcard?slug=${item.slug}`)
  assert.equal(card.status, 200)
  assert((await card.text()).includes('FN:Published validation'))
  const qr = await page.request.get(`${origin}/api/qr?slug=${item.slug}`)
  assert.equal(qr.status(), 200)
  assert(qr.headers()['content-type'].includes('image/png'))
  checks.push('private real Storage upload + explicit publication + photo/vCard/QR')

  const nextDraft = await api('/api/customer/profile', 'PUT', { expectedRevision: saved.data.profile.revision,
    draft: { ...draft, name: 'Private next validation' } })
  assert.equal(nextDraft.status, 200)
  const publicText = await (await fetch(`${origin}/t/${item.slug}`)).text()
  assert(publicText.includes('Published validation'))
  assert(!publicText.includes('Private next validation'))
  checked(await db.rpc('set_customer_status', { p_actor: actor, p_user: userId, p_status: 'suspended', p_reason: 'Disposable validation' }))
  assert.equal((await fetch(`${origin}/api/vcard?slug=${item.slug}`)).status, 404)
  assert.equal((await fetch(`${origin}/api/public/photo/${item.slug}`)).status, 404)
  assert.equal((await api('/api/customer/profile')).status, 403)
  checked(await db.rpc('set_customer_status', { p_actor: actor, p_user: userId, p_status: 'active', p_reason: 'Disposable validation' }))
  assert.equal((await api('/api/customer/profile/publish', 'DELETE')).status, 200)
  assert.equal((await fetch(`${origin}/api/vcard?slug=${item.slug}`)).status, 404)
  checks.push('published snapshot isolation + suspension + unpublication revocation')

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } })
  const signedIn = checked(await authClient.auth.signInWithPassword({ email, password }))
  assert.equal(signedIn.user.id, userId)
  assert((await authClient.rpc('publish_profile', { p_user_id: userId, p_revision: nextDraft.data.profile.revision })).error)
  checked(await db.from('users_roles').update({ role: 'admin' }).eq('user_id', userId))
  const admin = await api('/api/auth/session')
  assert.equal(admin.status, 200)
  assert.equal(admin.data.role, 'admin')
  assert.equal((await api('/api/admin/analytics?days=7')).status, 200)
  checked(await db.from('users_roles').update({ role: 'customer' }).eq('user_id', userId))
  checks.push('real sign-in + direct RPC denial + explicit backend admin promotion')
} finally {
  if (browser) await browser.close()
  if (userId && !baseline.includes(userId)) {
    try {
      checked(await db.from('users_roles').update({ role: 'customer' }).eq('user_id', userId))
      const job = checked(await db.rpc('begin_customer_deletion', { p_actor: actor, p_user: userId }))
      for (const object of job.object_inventory) checked(await db.storage.from(object.bucket).remove([object.object_path]))
      const deleted = await db.auth.admin.deleteUser(userId)
      if (deleted.error) throw deleted.error
      checked(await db.rpc('finish_customer_deletion', { p_actor: actor, p_job: job.id }))
      checks.push('real cleanup preserves retired item/history and removes temporary account/media')
    } catch (error) { cleanupError = error; console.error('Disposable validation cleanup needs attention:', error.code || 'cleanup_failure') }
  }
  const remaining = checked(await db.auth.admin.listUsers({ page: 1, perPage: 1000 })).users.map(user => user.id)
  assert.deepEqual(remaining.sort(), baseline.sort())
  console.log(JSON.stringify({ liveChecks: checks, originalAccountsPreserved: true, temporaryAccountRemoved: !cleanupError,
    smtpDeliveryTested: false, physicalNfcAndContactImportTested: false }, null, 2))
  if (cleanupError) throw cleanupError
}
