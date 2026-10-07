import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), requireUser: vi.fn(), tokenClient: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('../src/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('../src/lib/supabase/server', () => ({ createTokenClient: mocks.tokenClient, applyUserHeaders: (request, response) => response }))
import { readSetupGrant, grantHash, completeSetup } from '../src/lib/supabase/setup-grants'
import { GET, POST } from '../src/app/api/auth/setup/route'

describe('purpose-bound setup and cross-system retry', () => {
  let grant, auth, proof, token
  beforeEach(() => {
    token = 'a'.repeat(43)
    grant = { token_hash: grantHash(token), user_id: 'user', purpose: 'recovery',
      expires_at: new Date(Date.now() + 600_000).toISOString(), consumed_at: null, password_updated_at: null }
    const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn(async () => ({ data: grant })) }
    auth = {
      user: { id: 'user', email: 'person@test.com' }, role: 'customer', account: { status: 'active' },
      supabase: { from: vi.fn(() => chain), rpc: vi.fn(async name => ({ data: name === 'claim_setup_grant' ? { state: 'ready' } : { success: true } })) },
      userClient: { auth: { updateUser: vi.fn(async () => ({ data: { user: { id: 'user' } } })) } },
    }
    proof = { auth: { signInWithPassword: vi.fn(async () => ({ data: { user: { id: 'user' } } })), signOut: vi.fn(async () => ({})) } }
    mocks.cookies.mockResolvedValue({ get: () => ({ value: token }) })
    mocks.requireUser.mockResolvedValue(auth)
    mocks.tokenClient.mockReturnValue(proof)
  })
  const request = (body = { password: 'a-good-password' }, headers = {}) => new Request('https://app.test/api/auth/setup', {
    method: 'POST', headers: { origin: 'https://app.test', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  })

  it('cannot use a generic cookie Auth session without a server-issued grant', async () => {
    mocks.cookies.mockResolvedValue({ get: () => undefined })
    const response = await POST(request())
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'grant_missing' })
    expect(auth.userClient.auth.updateUser).not.toHaveBeenCalled()
    expect(auth.supabase.rpc).not.toHaveBeenCalled()
  })
  it('binds the capability to the verified user identity', async () => {
    grant.user_id = 'different-user'
    await expect(readSetupGrant(auth.supabase, 'user')).rejects.toMatchObject({ code: 'invalid_grant' })
    expect((await POST(request())).status).toBe(403)
    expect(auth.userClient.auth.updateUser).not.toHaveBeenCalled()
  })
  it('enforces immutable purpose, including UI purpose binding', async () => {
    await expect(readSetupGrant(auth.supabase, 'user', 'invite')).rejects.toMatchObject({ code: 'invalid_grant' })
    grant.purpose = 'email'
    expect((await POST(request())).status).toBe(403)
  })
  it.each([new Date(0).toISOString(), 'not-a-date'])('rejects expired or malformed expiry %s', async expiresAt => {
    grant.expires_at = expiresAt
    const response = await POST(request())
    expect(response.status).toBe(410)
    expect(response.cookies.get('beem_setup_grant').value).toBe('')
    expect(auth.userClient.auth.updateUser).not.toHaveBeenCalled()
  })
  it('GET rejects session-only setup and exposes ready/pending states only for a grant', async () => {
    const response = await GET(new Request('https://app.test/api/auth/setup?purpose=recovery'))
    expect(await response.json()).toMatchObject({ state: 'ready', purpose: 'recovery' })
    auth.role = null
    auth.account = null
    expect(await (await GET(new Request('https://app.test/api/auth/setup?purpose=recovery'))).json()).toMatchObject({ state: 'pending' })
    mocks.cookies.mockResolvedValue({ get: () => undefined })
    expect((await GET(new Request('https://app.test/api/auth/setup?purpose=recovery'))).status).toBe(403)
  })
  it('claims, updates Auth, records durable success, then atomically completes', async () => {
    const events = []
    auth.userClient.auth.updateUser.mockImplementation(async () => { events.push('auth'); return { data: { user: { id: 'user' } } } })
    auth.supabase.rpc.mockImplementation(async name => {
      events.push(name)
      return { data: name === 'claim_setup_grant' ? { state: 'ready' } : { success: true } }
    })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(events).toEqual(['claim_setup_grant', 'auth', 'mark_setup_password_updated', 'complete_setup_grant'])
    expect(response.cookies.get('beem_setup_grant').value).toBe('')
    expect(auth.supabase.rpc.mock.calls[0][1]).toMatchObject({ p_token_hash: grantHash(token), p_user_id: 'user' })
  })
  it('does not record completion after an Auth failure; releases definite policy failure', async () => {
    auth.userClient.auth.updateUser.mockResolvedValue({ error: { code: 'weak_password' } })
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(auth.supabase.rpc.mock.calls.map(call => call[0])).toEqual(['claim_setup_grant', 'release_setup_grant'])
  })
  it('retains an ambiguous Auth claim and never claims success on a lost response', async () => {
    auth.userClient.auth.updateUser.mockResolvedValue({ error: { code: 'network_error', status: 503 } })
    expect((await POST(request())).status).toBe(503)
    expect(auth.supabase.rpc.mock.calls.map(call => call[0])).toEqual(['claim_setup_grant'])
  })
  it('resumes a failed DB finalization without repeating Auth or OTP verification', async () => {
    let state = 'ready'
    let failFinish = true
    auth.supabase.rpc.mockImplementation(async name => {
      if (name === 'claim_setup_grant') return { data: { state } }
      if (name === 'mark_setup_password_updated') { state = 'password_updated'; return { data: { success: true } } }
      if (name === 'complete_setup_grant' && failFinish) return { error: { code: 'XX000' } }
      return { data: { success: true } }
    })
    expect((await POST(request())).status).toBe(503)
    failFinish = false
    expect((await POST(request())).status).toBe(200)
    expect(auth.userClient.auth.updateUser).toHaveBeenCalledTimes(1)
  })
  it('recovers the Auth-success/DB-marker gap by verifying same-password with Auth', async () => {
    auth.userClient.auth.updateUser.mockResolvedValue({ error: { code: 'same_password' } })
    expect((await POST(request())).status).toBe(200)
    expect(proof.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'person@test.com', password: 'a-good-password' })
    expect(proof.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.supabase.rpc).toHaveBeenCalledWith('mark_setup_password_updated', expect.any(Object))
  })
  it('does not report success for an unacknowledged database completion', async () => {
    auth.supabase.rpc.mockImplementation(async name => ({ data: name === 'claim_setup_grant' ? { state: 'password_updated' } : null }))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'setup_retry' })
    expect(response.cookies.get('beem_setup_grant')).toBeUndefined()
  })
  it('a failed durable Auth marker does not proceed to account completion', async () => {
    auth.supabase.rpc.mockImplementation(async name => name === 'mark_setup_password_updated'
      ? { error: { code: 'XX000' } } : { data: { state: 'ready' } })
    expect((await POST(request())).status).toBe(503)
    expect(auth.supabase.rpc.mock.calls.map(call => call[0])).toEqual(['claim_setup_grant', 'mark_setup_password_updated'])
  })
  it('same-password text alone never grants completion', async () => {
    auth.userClient.auth.updateUser.mockResolvedValue({ error: { code: 'same_password' } })
    proof.auth.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } })
    expect((await POST(request())).status).toBe(503)
    expect(auth.supabase.rpc.mock.calls.map(call => call[0])).toEqual(['claim_setup_grant'])
  })
  it('a consumed grant can acknowledge a committed retry but never change Auth again', async () => {
    grant.consumed_at = new Date().toISOString()
    auth.supabase.rpc.mockResolvedValue({ data: { state: 'completed' } })
    await completeSetup(auth, grant, 'different-password')
    expect(auth.userClient.auth.updateUser).not.toHaveBeenCalled()
    expect(auth.supabase.rpc).toHaveBeenCalledTimes(1)
  })
  it('rejects concurrent claims and suspension during finalization', async () => {
    auth.supabase.rpc.mockResolvedValueOnce({ error: { message: 'grant_busy' } })
    expect((await POST(request())).status).toBe(409)
    expect(auth.userClient.auth.updateUser).not.toHaveBeenCalled()
    auth.supabase.rpc.mockImplementation(async name => name === 'complete_setup_grant'
      ? { error: { message: 'account_inactive' } } : { data: name === 'claim_setup_grant' ? { state: 'password_updated' } : {} })
    expect((await POST(request())).status).toBe(403)
  })
  it('pending provisioning cannot change a password or mark setup complete', async () => {
    auth.account = null
    expect((await POST(request())).status).toBe(409)
    expect(auth.userClient.auth.updateUser).not.toHaveBeenCalled()
  })
  it('admins can recover their password without being converted to customer accounts', async () => {
    auth.role = 'admin'
    auth.account = null
    const status = await GET(new Request('https://app.test/api/auth/setup?purpose=recovery'))
    expect(await status.json()).toMatchObject({ state: 'ready', next: '/admin/nfc-items' })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, next: '/admin/nfc-items' })
    expect(auth.userClient.auth.updateUser).toHaveBeenCalledTimes(1)
  })
  it('admin recovery cannot use a customer invitation grant', async () => {
    auth.role = 'admin'
    auth.account = null
    grant.purpose = 'invite'
    expect((await POST(request())).status).toBe(403)
    expect(auth.userClient.auth.updateUser).not.toHaveBeenCalled()
    expect(auth.supabase.rpc).not.toHaveBeenCalled()
  })
  it.each(['short', 'a'.repeat(129), null])('bounds password input %s', async password => {
    expect((await POST(request({ password }))).status).toBe(400)
    expect(auth.userClient.auth.updateUser).not.toHaveBeenCalled()
  })
  it('rejects bearer-session setup and cross-origin submissions', async () => {
    expect((await POST(request({}, { authorization: 'Bearer token' }))).status).toBe(403)
    expect((await POST(request({}, { origin: 'https://evil.test' }))).status).toBe(403)
    expect(auth.userClient.auth.updateUser).not.toHaveBeenCalled()
  })
})
