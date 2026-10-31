import { requireUser } from '@/lib/auth'
import { apiError, jsonResponse, readJson, HttpError } from '@/lib/http'
import { checked, revision } from '@/lib/data'
import { linkError, linkLabel } from '@/lib/profile-links'

export async function POST(request) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'customer' })
    const body = await readJson(request)
    const draft = checked(await supabase.from('profiles').select('links').eq('user_id', user.id).single())
    for (const link of draft.links || []) {
      const error = linkError(link)
      if (error) throw new HttpError(400, `${linkLabel(link)}: ${error}`, 'invalid_link')
    }
    const publication = checked(await supabase.rpc('publish_profile', { p_user_id: user.id, p_revision: revision(body.revision) }))
    const account = checked(await supabase.from('customer_accounts').select('*').eq('user_id', user.id).single())
    return jsonResponse({ publication, account, hasPublished: true })
  } catch (error) { return apiError(error) }
}

export async function DELETE(request) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'customer' })
    checked(await supabase.rpc('unpublish_profile', { p_user_id: user.id }))
    return jsonResponse({ success: true })
  } catch (error) { return apiError(error) }
}
