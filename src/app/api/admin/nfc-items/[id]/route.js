import { requireUser } from '@/lib/auth'
import { apiError, jsonResponse, readJson } from '@/lib/http'
import { checked, uuid, revision } from '@/lib/data'

export async function PATCH(request, { params }) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'admin' })
    const { id } = await params
    const body = await readJson(request)
    const item = checked(await supabase.rpc('manage_nfc_item', { p_actor: user.id, p_item: uuid(id), p_action: body.action,
      p_expected_version: revision(body.version), p_target: body.targetOwnerId ? uuid(body.targetOwnerId) : null, p_reason: body.reason || '' }))
    return jsonResponse({ item })
  } catch (error) { return apiError(error) }
}

export async function DELETE(request, context) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'admin' })
    const { id } = await context.params
    const body = await readJson(request)
    const item = checked(await supabase.rpc('manage_nfc_item', { p_actor: user.id, p_item: uuid(id), p_action: 'retire',
      p_expected_version: revision(body.version), p_target: null, p_reason: body.reason || '' }))
    return jsonResponse({ item })
  } catch (error) { return apiError(error) }
}
