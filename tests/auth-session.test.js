import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), client: vi.fn(), signOut: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('../src/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('../src/lib/supabase/server', () => ({
  createUserClient: mocks.client, applyUserHeaders: (request, response) => response,
}))
const publicationClient = () => {
  const query = { select: () => query, eq: () => query, limit: async () => ({ data: [], error: null }) }
  return { from: () => query }
}
import { HttpError } from '../src/lib/http'
import { GET, POST } from '../src/app/api/auth/session/route'

describe('verified browser-layout session endpoint', () => {
  beforeEach(() => { mocks.client.mockResolvedValue({ auth: { signOut: mocks.signOut } }) })
  it('returns account setup status and a minimal verified identity', async () => {
    mocks.requireUser.mockResolvedValue({ user: { id: 'user', email: 'person@test.com', user_metadata: { arbitrary: true } }, role: 'customer',
      account: { status: 'active', setup_completed_at: null }, supabase: publicationClient() })
    const response = await GET(new Request('https://app.test/api/auth/session'))
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({ user: { id: 'user', email: 'person@test.com' }, role: 'customer',
      account: { status: 'active', setup_completed_at: null }, pending: false, setupRequired: true, hasPublished: false })
  })
  it('returns an honest pending state for incomplete provisioning', async () => {
    mocks.requireUser.mockResolvedValue({ user: { id: 'user' }, role: null, account: null })
    expect(await (await GET(new Request('https://app.test/api/auth/session'))).json()).toMatchObject({ pending: true, role: null, account: null })
  })
  it('signs out suspended cookie sessions and returns a terminal denial', async () => {
    mocks.requireUser.mockRejectedValue(new HttpError(403, 'Suspended', 'account_inactive'))
    const response = await GET(new Request('https://app.test/api/auth/session'))
    expect(response.status).toBe(403)
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(await response.json()).toMatchObject({ code: 'account_inactive' })
  })
  it('returns a minimal first-factor admin session for MFA enrollment, never business data', async () => {
    mocks.requireUser.mockResolvedValue({ user: { id: 'admin', email: 'admin@test.com' }, role: 'admin', account: null,
      session: { valid: true, expiresAt: 'later', idleExpiresAt: 'sooner' }, mfaRequired: true })
    const response = await GET(new Request('https://app.test/api/auth/session'))
    expect(mocks.requireUser).toHaveBeenCalledWith(expect.any(Request), { allowSetup: true, allowMfaPending: true })
    expect(await response.json()).toMatchObject({ role: 'admin', mfaRequired: true, account: null, hasPublished: false })
  })
  it('only activity POST opts into extending inactivity', async () => {
    mocks.requireUser.mockResolvedValue({ user: { id: 'user' }, role: 'customer', mfaRequired: false, session: { valid: true } })
    const response = await POST(new Request('https://app.test/api/auth/session', { method: 'POST', headers: { origin: 'https://app.test' } }))
    expect(mocks.requireUser).toHaveBeenCalledWith(expect.any(Request), { allowSetup: true, allowMfaPending: true, touch: true })
    expect(await response.json()).toEqual({ user: { id: 'user' }, role: 'customer', mfaRequired: false, session: { valid: true } })
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})
