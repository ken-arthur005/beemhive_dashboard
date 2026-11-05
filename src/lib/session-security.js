import 'server-only'
import { HttpError } from './http'

const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Identity has already been checked with getUser. Claims must still be cryptographically verified:
// neither getSession().user nor editable user_metadata can attest AAL or session ownership.
export async function authorizeSession(auth, userClient, { token, touch = false, allowMfaPending = false } = {}) {
  const { data, error } = await userClient.auth.getClaims(token)
  const claims = data?.claims
  if (error || claims?.sub !== auth.user.id || !sessionIdPattern.test(claims?.session_id || '')) {
    throw new HttpError(error?.status >= 500 ? 503 : 401, 'Please sign in again to continue.', 'unauthenticated')
  }
  const result = await auth.supabase.rpc('check_app_session', {
    p_user: auth.user.id, p_session: claims.session_id, p_touch: touch,
  })
  if (result.error || typeof result.data?.valid !== 'boolean') {
    throw new HttpError(503, 'Unable to verify session security. Please try again.', 'session_unavailable')
  }
  if (!result.data.valid) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'session_expired')
  const mfaRequired = auth.role === 'admin' && claims.aal !== 'aal2'
  if (mfaRequired && !allowMfaPending) {
    throw new HttpError(403, 'Verify your authenticator code to continue.', 'mfa_required')
  }
  return { session: result.data, mfaRequired }
}
