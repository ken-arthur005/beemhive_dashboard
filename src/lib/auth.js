import 'server-only'
import { HttpError, assertSameOrigin } from './http'
import { createServiceClient, createUserClient, createTokenClient } from './supabase/server'

export async function resolveAccount(supabase, user, { role: requiredRole, allowSetup = false } = {}) {
  const { data: roleRow, error: roleError } = await supabase.from('users_roles')
    .select('role').eq('user_id', user.id).maybeSingle()
  if (roleError) throw new HttpError(503, 'Unable to check your account role. Please try again.', 'account_unavailable')
  const role = roleRow?.role ?? null
  if (role && role !== 'admin' && role !== 'customer') {
    throw new HttpError(403, 'Your account does not have a supported role. Contact Beem Hive.', 'invalid_role')
  }
  if (!role && !allowSetup) throw new HttpError(403, 'Your account is still being provisioned. Contact Beem Hive.', 'role_missing')
  if (requiredRole && role && role !== requiredRole) throw new HttpError(403, 'This account cannot access this area.', 'wrong_role')

  let account = null
  if (role !== 'admin') {
    const result = await supabase.from('customer_accounts')
      .select('user_id,status,setup_completed_at,published_revision').eq('user_id', user.id).maybeSingle()
    if (result.error) throw new HttpError(503, 'Unable to check your account status. Please try again.', 'account_unavailable')
    account = result.data
    if (account && account.status !== 'active') {
      throw new HttpError(403, account.status === 'suspended'
        ? 'Your account is suspended. Contact Beem Hive for help.'
        : 'Your account is unavailable. Contact Beem Hive for help.', 'account_inactive')
    }
    if (!account && !allowSetup) throw new HttpError(409, 'Your account is still being provisioned. Please try again later.', 'account_pending')
  }
  // setup_completed_at gates publication, never draft editing.
  return { user, role, account, supabase }
}

export async function requireUser(request, options = {}) {
  assertSameOrigin(request)
  if (options.role && !['admin', 'customer'].includes(options.role)) {
    throw new HttpError(403, 'Unsupported account role.', 'invalid_role')
  }
  const authorization = request.headers.get('authorization')
  let userClient
  let result
  if (authorization !== null) {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization)
    if (!match) throw new HttpError(401, 'A valid bearer token is required.', 'invalid_token')
    userClient = createTokenClient(match[1])
    result = await userClient.auth.getUser(match[1])
  } else {
    userClient = await createUserClient(request)
    result = await userClient.auth.getUser()
  }
  if (result.error || !result.data?.user) {
    if (result.error?.status >= 500) throw new HttpError(503, 'Sign-in is temporarily unavailable. Please try again.', 'auth_unavailable')
    throw new HttpError(401, 'Please sign in to continue.', 'unauthenticated')
  }
  const resolved = await resolveAccount(createServiceClient(), result.data.user, options)
  return { ...resolved, userClient }
}
