import { requireUser } from '@/lib/auth'
import { createTokenClient } from '@/lib/supabase/server'
import { apiError, HttpError, jsonResponse, readJson } from '@/lib/http'
import { checked, uuid, authDirectory } from '@/lib/data'
import { appOrigin, itemUrl } from '@/lib/platform'

export async function POST(request) {
  let operation
  let service
  try {
    const { user, supabase } = await requireUser(request, { role: 'admin' })
    service = supabase
    const body = await readJson(request)
    if (body.mode === 'resend') {
      const id = uuid(body.userId)
      checked(await supabase.rpc('claim_setup_email', { p_actor: user.id, p_user: id }))
      const target = checked(await supabase.auth.admin.getUserById(id)).user
      const result = await createTokenClient().auth.resetPasswordForEmail(target.email, { redirectTo: `${appOrigin()}/auth/confirm?type=recovery` })
      if (result.error) throw new HttpError(result.error.status === 429 ? 429 : 503, 'The setup email could not be sent. Please retry later.')
      return jsonResponse({ success: true })
    }
    const id = uuid(body.operationKey, 'Operation')
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.customerName === 'string' ? body.customerName.trim() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || name.length < 2 || name.length > 120 ||
      !['card', 'stand', 'round_tag'].includes(body.productType) || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(body.slug || '')) {
      throw new HttpError(400, 'Provide a valid name, email, product type and lowercase slug.')
    }
    operation = checked(await supabase.rpc('claim_provisioning', { p_id: id, p_email: email, p_name: name,
      p_product_type: body.productType, p_slug: body.slug }))
    if (operation.status === 'completed') {
      const item = checked(await supabase.from('nfc_items').select('*').eq('operation_key', id).single())
      return jsonResponse({ item: { ...item, ownerEmail: email, url: itemUrl(item.slug) }, operationId: id })
    }
    let userId = operation.user_id
    if (!userId) {
      const existing = (await authDirectory(supabase)).find(account => account.email?.toLowerCase() === email)
      if (existing) {
        // Reconcile an ambiguous earlier invite, but never reinterpret an old
        // account as a new customer or overwrite its role/profile.
        if (Date.parse(existing.created_at) < Date.parse(operation.created_at) - 5000) throw new HttpError(409, 'This account already exists. Choose “Existing customer” to assign another item.', 'existing_customer')
        userId = existing.id
      } else {
        const invited = await supabase.auth.admin.inviteUserByEmail(email, { data: { full_name: name },
          redirectTo: `${appOrigin()}/auth/confirm?type=invite` })
        if (invited.error || !invited.data?.user?.id) throw new HttpError(invited.error?.status === 429 ? 429 : 503,
          'The invitation could not be confirmed. Retry this operation; existing records will be reconciled.', 'invite_retry')
        userId = invited.data.user.id
      }
      checked(await supabase.from('provisioning_operations').update({ user_id: userId, status: 'invited' }).eq('id', id))
    }
    checked(await supabase.rpc('ensure_customer', { p_user_id: userId, p_name: name }))
    const item = checked(await supabase.rpc('create_nfc_item', { p_actor: user.id, p_owner: userId, p_slug: body.slug,
      p_product_type: body.productType, p_operation_key: id }))
    checked(await supabase.from('provisioning_operations').update({ status: 'completed', lease_until: null,
      last_error: null, updated_at: new Date().toISOString() }).eq('id', id))
    return jsonResponse({ item: { ...item, ownerEmail: email, tapCount: 0, url: itemUrl(item.slug) }, operationId: id }, 201)
  } catch (error) {
    if (operation && operation.status !== 'completed' && service) {
      await service.from('provisioning_operations').update({ status: 'failed', lease_until: null,
        last_error: 'Provisioning requires reconciliation and retry.', updated_at: new Date().toISOString() }).eq('id', operation.id)
    }
    if (error?.message?.includes('email_rate_limit')) return jsonResponse({ error: 'Wait one minute before sending another setup email.', code: 'email_rate_limit' }, 429)
    return apiError(error)
  }
}
