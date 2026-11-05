import { expect, test, vi } from 'vitest'
import { enrollAuthenticator, totpFactors, verifyAuthenticator } from '../src/lib/mfa'

function client(factors = []) {
  return { auth: { getUser: vi.fn(async () => ({ data: { user: { factors } } })), mfa: {
    listFactors: vi.fn(async () => ({ data: { totp: factors } })),
    enroll: vi.fn(async () => ({ data: { id: 'new', totp: { secret: 'secret', qr_code: 'data:image/svg+xml;...' } } })),
    unenroll: vi.fn(async () => ({ error: null })), challengeAndVerify: vi.fn(async () => ({ error: null })),
  } } }
}

test('enrollment clears only unfinished TOTP factors and uses native Supabase QR generation', async () => {
  const c = client([{ id: 'unfinished', factor_type: 'totp', status: 'unverified' }])
  expect((await enrollAuthenticator(c)).id).toBe('new')
  expect(c.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'unfinished' })
  expect(c.auth.mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', issuer: 'Beem Hive', friendlyName: 'Beem Hive admin' })
})
test('a verified factor cannot be replaced through first-time setup', async () => {
  const c = client([{ id: 'verified', factor_type: 'totp', status: 'verified' }])
  await expect(enrollAuthenticator(c)).rejects.toThrow('already enabled')
  expect(c.auth.mfa.unenroll).not.toHaveBeenCalled()
  expect(c.auth.mfa.enroll).not.toHaveBeenCalled()
  expect(await totpFactors(c)).toHaveLength(1)
})
test('only verified factors are offered at sign-in and malformed codes never reach Auth', async () => {
  const c = client([{ id: 'unfinished', status: 'unverified' }])
  expect(await totpFactors(c)).toEqual([])
  await expect(verifyAuthenticator(c, 'factor', '12x456')).rejects.toThrow('six-digit')
  expect(c.auth.mfa.challengeAndVerify).not.toHaveBeenCalled()
  await verifyAuthenticator(c, 'factor', '012345')
  expect(c.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor', code: '012345' })
})
