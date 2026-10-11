import { requireUser } from '@/lib/auth'
import { apiError, jsonResponse, readJson } from '@/lib/http'
import { checked, revision } from '@/lib/data'
import { itemUrl } from '@/lib/platform'
import { hasPublishedProfile } from '@/lib/publication-history'

function preview(profile) {
  return { ...profile, photo_url: profile.photo_asset_id ? `/api/customer/media/${profile.photo_asset_id}` : null }
}

export async function GET(request) {
  try {
    const auth = await requireUser(request, { role: 'customer' })
    const { user, account, supabase } = auth
    const [profile, items, hasPublished] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single().then(checked),
      supabase.from('nfc_items').select('*').eq('owner_id', user.id).order('created_at').then(checked),
      hasPublishedProfile(auth),
    ])
    const publication = account.published_revision == null ? null : checked(await supabase.from('profile_publications')
      .select('*').eq('user_id', user.id).eq('revision', account.published_revision).single())
    return jsonResponse({ profile: preview(profile), account, publication, hasPublished,
      items: items.map(item => ({ ...item, url: itemUrl(item.slug) })) })
  } catch (error) { return apiError(error) }
}

export async function PUT(request) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'customer' })
    const { expectedRevision, draft } = await readJson(request)
    const profile = checked(await supabase.rpc('save_profile_draft', {
      p_user_id: user.id, p_expected_revision: revision(expectedRevision), p_draft: draft,
    }))
    return jsonResponse({ profile: preview(profile) })
  } catch (error) { return apiError(error) }
}
