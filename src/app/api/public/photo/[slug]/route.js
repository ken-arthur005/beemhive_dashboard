import { publicProfile } from '@/lib/public-profile'
import { checked } from '@/lib/data'
import { apiError, HttpError } from '@/lib/http'
import { mediaResponse } from '@/lib/media'

export const runtime = 'nodejs'

export async function GET(request, { params }) {
  try {
    const { slug } = await params
    const { profile, supabase } = await publicProfile(slug, request.headers)
    if (!profile?.content.photo_asset_id) throw new HttpError(404, 'Photo not available.')
    const asset = checked(await supabase.from('profile_media').select('*').eq('id', profile.content.photo_asset_id)
      .eq('owner_id', profile.owner_id).maybeSingle())
    if (!asset) throw new HttpError(404, 'Photo not available.')
    return await mediaResponse(supabase, asset)
  } catch (error) { return apiError(error) }
}
