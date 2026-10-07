import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { HttpError } from '../http'
import { createTokenClient } from './server'

export const SETUP_COOKIE = 'beem_setup_grant'
export const SETUP_TTL = 30 * 60
const purposes = new Set(['invite', 'recovery'])

export function grantHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function setupCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SETUP_TTL }
}

export function clearSetupCookie(response) {
  response.cookies.set(SETUP_COOKIE, '', { ...setupCookieOptions(), maxAge: 0 })
  return response
}

export async function issueSetupGrant(supabase, userId, purpose, response) {
  if (!purposes.has(purpose)) throw new HttpError(400, 'Unsupported setup purpose.', 'invalid_grant')
  const token = randomBytes(32).toString('base64url')
  const { error } = await supabase.from('setup_grants').insert({
    token_hash: grantHash(token), user_id: userId, purpose,
    expires_at: new Date(Date.now() + SETUP_TTL * 1000).toISOString(), consumed_at: null,
  })
  if (error) throw new HttpError(503, 'Your link was verified, but setup could not start. Please request a new link.', 'grant_issue_failed')
  // Only send the capability after its durable insert succeeds.
  response.cookies.set(SETUP_COOKIE, token, setupCookieOptions())
}

export async function readSetupGrant(supabase, userId, expectedPurpose) {
  const token = (await cookies()).get(SETUP_COOKIE)?.value
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new HttpError(403, 'Open a fresh invitation or password reset email to continue.', 'grant_missing')
  }
  const tokenHash = grantHash(token)
  const { data: grant, error } = await supabase.from('setup_grants')
    .select('token_hash,user_id,purpose,expires_at,consumed_at,password_updated_at')
    .eq('token_hash', tokenHash).maybeSingle()
  if (error) throw new HttpError(503, 'Unable to check your setup link. Please try again.', 'grant_unavailable')
  if (!grant || grant.user_id !== userId || !purposes.has(grant.purpose)
    || (expectedPurpose && grant.purpose !== expectedPurpose)) {
    throw new HttpError(403, 'This setup link is not valid for your account.', 'invalid_grant')
  }
  if (!Number.isFinite(Date.parse(grant.expires_at)) || Date.parse(grant.expires_at) <= Date.now()) {
    throw new HttpError(410, 'Your setup link has expired. Please request a new one.', 'grant_expired')
  }
  return grant
}

async function grantRpc(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    if (error.message?.includes('grant_expired')) throw new HttpError(410, 'Your setup link has expired. Please request a new one.', 'grant_expired')
    if (error.message?.includes('grant_busy')) throw new HttpError(409, 'Setup is already processing. Wait a moment, then retry.', 'grant_busy')
    if (error.message?.includes('account_inactive')) throw new HttpError(403, 'Your account is unavailable. Contact Beem Hive.', 'account_inactive')
    if (error.message?.includes('invalid_grant')) throw new HttpError(403, 'Your setup link is no longer valid.', 'invalid_grant')
    throw new HttpError(503, 'Setup has not finished. Retry on this page with the same password.', 'setup_retry')
  }
  if (name !== 'claim_setup_grant' && data?.success !== true) {
    throw new HttpError(503, 'Setup has not finished. Retry on this page with the same password.', 'setup_retry')
  }
  return data
}

async function updatePassword(userClient, user, password) {
  const { data, error } = await userClient.auth.updateUser({ password })
  if (!error && data?.user?.id === user.id) return
  // An Auth success followed by a lost DB response/crash can return same_password
  // on retry. Verify it with Auth, not the error text or an account timestamp.
  if (error?.code === 'same_password' && user.email) {
    const isolated = createTokenClient()
    const result = await isolated.auth.signInWithPassword({ email: user.email, password })
    if (!result.error && result.data?.user?.id === user.id) {
      try { await isolated.auth.signOut({ scope: 'local' }) } catch { /* The verified password result remains valid. */ }
      return
    }
  }
  if (error?.code === 'weak_password') throw new HttpError(400, 'This password does not meet the account password policy. Choose a stronger password.', 'weak_password')
  if (error?.code === 'reauthentication_needed') throw new HttpError(403, 'Please open a new password reset email to verify your identity again.', 'reauthentication_needed')
  throw new HttpError(error?.status === 429 ? 429 : 503, 'The password change could not be confirmed. Retry with the same password.', 'password_update_failed')
}

export async function completeSetup({ supabase, userClient, user, account, role }, grant, password) {
  if (role === 'admin' && grant.purpose !== 'recovery') {
    throw new HttpError(403, 'Administrators must use a password recovery link.', 'wrong_role')
  }
  if (role !== 'admin' && (role !== 'customer' || !account)) {
    throw new HttpError(409, 'Your account is still being provisioned. Please retry shortly or contact Beem Hive.', 'account_pending')
  }
  const args = { p_token_hash: grant.token_hash, p_user_id: user.id, p_claim_id: randomUUID() }
  const claim = await grantRpc(supabase, 'claim_setup_grant', args)
  if (claim?.state === 'completed') return
  if (!['ready', 'password_updated'].includes(claim?.state)) {
    throw new HttpError(503, 'Unable to start setup. Please try again.', 'setup_retry')
  }
  if (claim.state === 'ready') {
    try {
      await updatePassword(userClient, user, password)
    } catch (error) {
      // A definite policy failure is safe to unlock immediately. Unknown Auth
      // outcomes retain the lease; retry after it expires using the same password.
      if (['weak_password', 'reauthentication_needed'].includes(error.code)) {
        await supabase.rpc('release_setup_grant', args)
      }
      throw error
    }
    await grantRpc(supabase, 'mark_setup_password_updated', args)
  }
  // This RPC rechecks active status and atomically consumes the grant + records
  // setup completion. A failed finalization resumes without changing Auth twice.
  await grantRpc(supabase, 'complete_setup_grant', args)
}
