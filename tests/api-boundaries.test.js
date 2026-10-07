import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HttpError } from '../src/lib/http.js'

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), publicProfile: vi.fn(), resumeDeletion: vi.fn(), qr: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/public-profile', () => ({ publicProfile: mocks.publicProfile }))
vi.mock('@/lib/deletions', () => ({ resumeDeletion: mocks.resumeDeletion }))
vi.mock('qrcode', () => ({ default: { toBuffer: mocks.qr } }))

import { PUT as saveDraft } from '../src/app/api/customer/profile/route.js'
import { POST as publish } from '../src/app/api/customer/profile/publish/route.js'
import { PATCH as itemAction } from '../src/app/api/admin/nfc-items/[id]/route.js'
import { DELETE as deleteCustomer } from '../src/app/api/admin/customers/[id]/route.js'
import { GET as downloadContact } from '../src/app/api/vcard/route.js'
import { GET as downloadQr } from '../src/app/api/qr/route.js'

const userId = '20000000-0000-0000-0000-000000000001'
const otherId = '20000000-0000-0000-0000-000000000002'
let service
let query
function request(url, method = 'POST', body = {}) {
  return new Request(`https://app.test${url}`, { method, ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json', Origin: 'https://app.test' }, body: JSON.stringify(body) }) })
}
beforeEach(() => {
  vi.clearAllMocks()
  query = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() }
  for (const name of ['select', 'eq', 'neq']) query[name].mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: null, error: null })
  query.single.mockResolvedValue({ data: { status: 'active' }, error: null })
  service = { rpc: vi.fn(), from: vi.fn(() => query), auth: { admin: { getUserById: vi.fn() } } }
  mocks.requireUser.mockResolvedValue({ user: { id: userId }, role: 'customer', account: { status: 'active' }, supabase: service })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

test('unauthenticated draft writes are denied before privileged RPC execution', async () => {
  mocks.requireUser.mockRejectedValue(new HttpError(401, 'Sign in'))
  const response = await saveDraft(request('/api/customer/profile', 'PUT', { expectedRevision: 0, draft: {} }))
  expect(response.status).toBe(401)
  expect(service.rpc).not.toHaveBeenCalled()
})

test('draft CAS uses verified identity and maps stale revisions to a conflict', async () => {
  service.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'Profile revision conflict' } })
  const draft = { name: 'Updated' }
  const response = await saveDraft(request('/api/customer/profile', 'PUT', { userId: otherId, expectedRevision: '4', draft }))
  expect(service.rpc).toHaveBeenCalledWith('save_profile_draft', { p_user_id: userId, p_expected_revision: '4', p_draft: draft })
  expect(response.status).toBe(409)
})

test('publication is an explicit service RPC and cannot attest setup through request fields', async () => {
  service.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Setup required' } })
  const response = await publish(request('/api/customer/profile/publish', 'POST', { revision: 3, setup_completed_at: new Date().toISOString(), userId: otherId }))
  expect(service.rpc).toHaveBeenCalledWith('publish_profile', { p_user_id: userId, p_revision: '3' })
  expect(response.status).toBe(403)
})

test('item transfer requires admin guard and passes the expected version and verified actor', async () => {
  service.rpc.mockResolvedValue({ data: { id: otherId, is_active: false }, error: null })
  const response = await itemAction(request('/api/admin/nfc-items/x', 'PATCH', { action: 'transfer', version: 7, targetOwnerId: otherId, actor: otherId }), { params: Promise.resolve({ id: otherId }) })
  expect(mocks.requireUser).toHaveBeenCalledWith(expect.any(Request), { role: 'admin' })
  expect(service.rpc).toHaveBeenCalledWith('manage_nfc_item', expect.objectContaining({ p_actor: userId, p_item: otherId, p_expected_version: '7', p_target: otherId }))
  expect(response.status).toBe(200)
})

test('legacy user-ID contact requests cannot bypass item eligibility', async () => {
  const response = await downloadContact(request(`/api/vcard?userId=${userId}`, 'GET'))
  expect(response.status).toBe(400)
  expect(mocks.publicProfile).not.toHaveBeenCalled()
})

test('contact downloads require an eligible publication and its published preference', async () => {
  mocks.publicProfile.mockResolvedValue({ profile: null })
  expect((await downloadContact(request('/api/vcard?slug=card-one', 'GET'))).status).toBe(404)
  mocks.publicProfile.mockResolvedValue({ profile: { content: { name: 'Hidden', show_save_contact: false } } })
  expect((await downloadContact(request('/api/vcard?slug=card-one', 'GET'))).status).toBe(404)
  mocks.publicProfile.mockResolvedValue({ profile: { content: { name: 'Published', show_save_contact: true, links: [] } } })
  const response = await downloadContact(request('/api/vcard?slug=card-one', 'GET'))
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toContain('no-store')
  expect(await response.text()).toContain('FN:Published')
})

test('a customer cannot generate another owner’s QR code', async () => {
  const response = await downloadQr(request('/api/qr?slug=other-card', 'GET'))
  expect(query.eq).toHaveBeenCalledWith('owner_id', userId)
  expect(response.status).toBe(404)
  expect(mocks.qr).not.toHaveBeenCalled()
})

test('QR encodes the configured stable item URL without changing publication', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://beemhive.vercel.app')
  query.maybeSingle.mockResolvedValue({ data: { slug: 'card-one', owner_id: userId }, error: null })
  mocks.qr.mockResolvedValue(Buffer.from('PNG'))
  const response = await downloadQr(request('/api/qr?slug=card-one', 'GET'))
  expect(mocks.qr).toHaveBeenCalledWith('https://beemhive.vercel.app/t/card-one', expect.objectContaining({ type: 'png' }))
  expect(service.rpc).not.toHaveBeenCalled()
  expect(response.headers.get('Content-Type')).toBe('image/png')
  vi.unstubAllEnvs()
})

test('transient Auth lookup failures cannot falsely confirm deletion with an unrelated job ID', async () => {
  service.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { status: 503, message: 'Unavailable' } })
  const response = await deleteCustomer(request(`/api/admin/customers/${otherId}`, 'DELETE', { confirmEmail: 'someone@example.test', jobId: userId }), { params: Promise.resolve({ id: otherId }) })
  expect(response.status).toBe(500)
  expect(mocks.resumeDeletion).not.toHaveBeenCalled()
  expect(service.rpc).not.toHaveBeenCalled()
})

test('a missing account resumes its target-bound pending job without requiring a lost response ID', async () => {
  const job = { id: userId, target_user_id: otherId, status: 'failed', object_inventory: [] }
  service.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { status: 404, code: 'user_not_found' } })
  query.maybeSingle.mockResolvedValue({ data: job, error: null })
  mocks.resumeDeletion.mockResolvedValue({ ...job, status: 'completed' })
  const response = await deleteCustomer(request(`/api/admin/customers/${otherId}`, 'DELETE'), { params: Promise.resolve({ id: otherId }) })
  expect(query.eq).toHaveBeenCalledWith('target_user_id', otherId)
  expect(mocks.resumeDeletion).toHaveBeenCalledWith(service, userId, job)
  expect(await response.json()).toEqual({ success: true, jobId: userId })
})
