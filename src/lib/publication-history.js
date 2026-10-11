import 'server-only'
import { checked } from './data'

// Publication snapshots are retained on unpublish, so onboarding never resets.
export async function hasPublishedProfile({ role, account, supabase, user }) {
  if (role !== 'customer' || !account) return false
  if (account.published_revision != null) return true
  const rows = checked(await supabase.from('profile_publications').select('revision').eq('user_id', user.id).limit(1))
  return rows.length > 0
}
