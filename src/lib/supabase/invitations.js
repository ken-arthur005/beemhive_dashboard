import 'server-only'
import { HttpError } from '../http'

// Call only after GoTrue verifies the invite/recovery credential and identity.
// Existing roles are authoritative: no client metadata may select admin access.
export async function provisionVerifiedInvite(supabase, user) {
  const { data: existing, error } = await supabase.from('users_roles').select('role').eq('user_id', user.id).maybeSingle()
  if (error) throw new HttpError(503, 'Unable to check your invitation account. Please request a fresh setup link.', 'account_unavailable')
  if (existing?.role === 'admin') return
  if (existing?.role && existing.role !== 'customer') throw new HttpError(403, 'This account has an unsupported role.', 'invalid_role')
  const displayName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim().slice(0, 120) : ''
  const name = displayName || user.email?.split('@')[0]?.slice(0, 120) || 'Beem Hive customer'
  const result = await supabase.rpc('ensure_customer', { p_user_id: user.id, p_name: name })
  if (result.error) throw new HttpError(503, 'Your email was verified, but account provisioning did not finish. Request a new setup link to retry.', 'provisioning_retry')
}
