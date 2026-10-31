import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { visitorIdentity, visitorHash, VISITOR_COOKIE } from '../src/lib/visitor'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }))
import { POST } from '../src/app/api/public/events/route'

beforeEach(() => { vi.stubEnv('IP_HASH_SALT', 'test-secret'.repeat(4)); mocks.rpc.mockResolvedValue({ data: true, error: null }) })
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

const request = (body = {}, headers = {}) => new Request('https://app.test/api/public/events', {
  method: 'POST', headers: { origin: 'https://app.test', 'content-type': 'application/json', 'user-agent': 'iPhone Mobile', ...headers },
  body: JSON.stringify({ slug: 'test-card', revision: 3, type: 'profile_view', eventId: randomUUID(), visitId: randomUUID(), ...body }),
})

test('anonymous identities survive revisits and signed cookies cannot be replaced by fabricated IDs', () => {
  const first = visitorIdentity(new Headers(), true)
  const next = visitorIdentity(new Headers({ cookie: `${VISITOR_COOKIE}=${first.token}` }), true)
  expect(next).toMatchObject({ id: first.id, fresh: false })
  expect(visitorHash(next)).toBe(visitorHash(first))
  const forged = first.token.replace(first.id, randomUUID())
  expect(visitorIdentity(new Headers({ cookie: `${VISITOR_COOKIE}=${forged}` }))).toBeNull()
})

test('view recording sets an HTTP-only first-party cookie and uses a server-derived identity', async () => {
  const response = await POST(request({ visitorHash: 'untrusted', referrer: 'https://source.test/private?email=private@example.test' }))
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i)
  expect(response.headers.get('set-cookie')).toMatch(/Secure/i)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(mocks.rpc).toHaveBeenCalledWith('record_profile_interaction', expect.objectContaining({ p_visitor_hash: expect.stringMatching(/^[a-f0-9]{64}$/), p_revision: '3', p_event_type: 'profile_view', p_referrer: 'https://source.test' }))
})

test('cross-origin, bot and prefetched requests do not write analytics', async () => {
  expect((await POST(request({}, { origin: 'https://evil.test' }))).status).toBe(403)
  expect((await POST(request({}, { 'user-agent': 'Googlebot' }))).status).toBe(204)
  expect((await POST(request({}, { purpose: 'prefetch' }))).status).toBe(204)
  expect(mocks.rpc).not.toHaveBeenCalled()
})

test('clicks require the existing visitor cookie, a bounded published link index, and event UUIDs', async () => {
  expect((await POST(request({ type: 'link_click', linkIndex: 0 }))).status).toBe(204)
  expect((await POST(request({ type: 'link_click', linkIndex: 8 }))).status).toBe(400)
  expect((await POST(request({ eventId: 'fake' }))).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
  const identity = visitorIdentity(new Headers(), true)
  expect((await POST(request({ type: 'link_click', linkIndex: 0 }, { cookie: `${VISITOR_COOKIE}=${identity.token}` }))).status).toBe(200)
})
