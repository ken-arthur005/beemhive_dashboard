import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cookie: vi.fn(), token: vi.fn(), service: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('../src/lib/supabase/server', () => ({
  createServiceClient: mocks.service, createUserClient: mocks.cookie, createTokenClient: mocks.token,
}))
import { requireUser } from '../src/lib/auth'

function db(role = 'customer', account = { user_id: 'user', status: 'active', setup_completed_at: null }) {
  return { rpc: vi.fn(async () => ({ data: { valid: true, expiresAt: '2026-11-06T00:00:00Z', idleExpiresAt: '2026-11-05T12:30:00Z', serverNow: '2026-11-05T12:00:00Z' } })), from: vi.fn(table => {
    const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: table === 'users_roles' ? (role === null ? null : { role }) : account })) }
    return chain
  }) }
}

describe('verified API authorization', () => {
  let client
  beforeEach(() => {
    client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user' } } })),
      getClaims: vi.fn(async () => ({ data: { claims: { sub: 'user', session_id: '30000000-0000-0000-0000-000000000001', aal: 'aal2' } } })) } }
    mocks.cookie.mockResolvedValue(client)
    mocks.token.mockReturnValue(client)
    mocks.service.mockReturnValue(db())
  })
  const request = (headers = {}, method = 'GET') => new Request('https://app.test/api/customer/profile', { headers, method })

  it('allows active setup-incomplete customers to edit drafts and returns both clients', async () => {
    const result = await requireUser(request({ origin: 'https://app.test' }, 'PUT'), { role: 'customer' })
    expect(result).toMatchObject({ role: 'customer', account: { setup_completed_at: null }, user: { id: 'user' }, userClient: client })
    expect(client.auth.getUser).toHaveBeenCalledWith()
  })
  it('verifies bearer identity explicitly and does not read a cookie session', async () => {
    await requireUser(request({ authorization: 'Bearer token' }), { role: 'customer' })
    expect(mocks.token).toHaveBeenCalledWith('token')
    expect(client.auth.getUser).toHaveBeenCalledWith('token')
    expect(mocks.cookie).not.toHaveBeenCalled()
  })
  it('does not fall back from invalid bearer credentials to cookies', async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } })
    await expect(requireUser(request({ authorization: 'Bearer invalid' }))).rejects.toMatchObject({ status: 401 })
    expect(mocks.cookie).not.toHaveBeenCalled()
    expect(mocks.service).not.toHaveBeenCalled()
  })
  it.each(['Basic token', 'Bearer ', 'Bearer x y'])('rejects malformed authorization: %s', async authorization => {
    await expect(requireUser(request({ authorization }))).rejects.toMatchObject({ status: 401 })
  })
  it('rejects cross-origin cookie mutations before contacting Auth', async () => {
    await expect(requireUser(request({ origin: 'https://evil.test' }, 'POST'))).rejects.toMatchObject({ status: 403, code: 'invalid_origin' })
    expect(client.auth.getUser).not.toHaveBeenCalled()
  })
  it.each(['suspended', 'deleting', 'unknown'])('allowSetup never allows %s', async status => {
    mocks.service.mockReturnValue(db('customer', { status }))
    await expect(requireUser(request(), { role: 'customer', allowSetup: true })).rejects.toMatchObject({ status: 403, code: 'account_inactive' })
  })
  it('allows missing account only with allowSetup', async () => {
    mocks.service.mockReturnValue(db('customer', null))
    await expect(requireUser(request(), { role: 'customer' })).rejects.toMatchObject({ code: 'account_pending' })
    expect((await requireUser(request(), { role: 'customer', allowSetup: true })).account).toBeNull()
  })
  it('reports a missing role as pending only with allowSetup; never invents a role', async () => {
    mocks.service.mockReturnValue(db(null, null))
    await expect(requireUser(request())).rejects.toMatchObject({ code: 'role_missing' })
    expect(await requireUser(request(), { allowSetup: true })).toMatchObject({ role: null, account: null })
  })
  it.each(['owner', 'staff', 'superadmin'])('rejects unsupported roles even during setup: %s', async role => {
    mocks.service.mockReturnValue(db(role))
    await expect(requireUser(request(), { allowSetup: true })).rejects.toMatchObject({ code: 'invalid_role' })
  })
  it('requires exact requested role and allows admins without customer accounts', async () => {
    mocks.service.mockReturnValue(db('admin', null))
    await expect(requireUser(request(), { role: 'customer', allowSetup: true })).rejects.toMatchObject({ code: 'wrong_role' })
    expect(await requireUser(request(), { role: 'admin' })).toMatchObject({ role: 'admin', account: null })
  })
  it('rejects a signed-in customer requesting admin access', async () => {
    await expect(requireUser(request(), { role: 'admin' })).rejects.toMatchObject({ status: 403, code: 'wrong_role' })
  })
  it('surfaces unavailable role reads, rather than treating them as absent', async () => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ error: { code: 'XX000' } }) }
    mocks.service.mockReturnValue({ from: () => chain })
    await expect(requireUser(request(), { allowSetup: true })).rejects.toMatchObject({ status: 503 })
  })
  it('rejects admin API access without verified MFA, including bearer requests', async () => {
    mocks.service.mockReturnValue(db('admin', null))
    client.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'user', session_id: '30000000-0000-0000-0000-000000000001', aal: 'aal1' } } })
    await expect(requireUser(request({ authorization: 'Bearer token' }), { role: 'admin' })).rejects.toMatchObject({ status: 403, code: 'mfa_required' })
    expect(client.auth.getClaims).toHaveBeenCalledWith('token')
    expect(await requireUser(request(), { allowMfaPending: true })).toMatchObject({ mfaRequired: true })
  })
  it('does not trust forged claims, mismatched subjects or missing session IDs', async () => {
    for (const result of [{ error: { status: 401 } }, { data: { claims: { sub: 'other' } } }, { data: { claims: { sub: 'user' } } }]) {
      client.auth.getClaims.mockResolvedValue(result)
      await expect(requireUser(request())).rejects.toMatchObject({ status: 401 })
    }
  })
  it('fails closed when the session migration or backend is unavailable', async () => {
    const backend = db()
    backend.rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
    mocks.service.mockReturnValue(backend)
    await expect(requireUser(request())).rejects.toMatchObject({ status: 503, code: 'session_unavailable' })
  })
  it('enforces server expiry before using privileged endpoints', async () => {
    const backend = db()
    backend.rpc.mockResolvedValue({ data: { valid: false } })
    mocks.service.mockReturnValue(backend)
    await expect(requireUser(request())).rejects.toMatchObject({ status: 401, code: 'session_expired' })
  })
  it('ordinary requests do not extend inactivity; only explicit activity opts in', async () => {
    const backend = db()
    mocks.service.mockReturnValue(backend)
    await requireUser(request())
    expect(backend.rpc).toHaveBeenLastCalledWith('check_app_session', expect.objectContaining({ p_touch: false }))
    await requireUser(request({ origin: 'https://app.test' }, 'POST'), { touch: true })
    expect(backend.rpc).toHaveBeenLastCalledWith('check_app_session', expect.objectContaining({ p_touch: true }))
  })
})
