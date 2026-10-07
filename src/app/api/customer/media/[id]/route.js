import { requireUser } from '@/lib/auth'
import { apiError, HttpError } from '@/lib/http'
import { checked, uuid } from '@/lib/data'
import { mediaResponse } from '@/lib/media'

export const runtime = 'nodejs'

export async function GET(request, { params }) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'customer' })
    const { id } = await params
    const asset = checked(await supabase.from('profile_media').select('*').eq('id', uuid(id)).eq('owner_id', user.id).maybeSingle())
    if (!asset) throw new HttpError(404, 'Photo not found.')
    return await mediaResponse(supabase, asset)
  } catch (error) { return apiError(error) }
}
