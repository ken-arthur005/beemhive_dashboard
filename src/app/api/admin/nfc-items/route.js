import { requireUser } from '@/lib/auth'
import { apiError, HttpError, jsonResponse, readJson } from '@/lib/http'
import { checked, uuid, listParameters, authDirectory } from '@/lib/data'
import { itemUrl } from '@/lib/platform'

export async function GET(request) {
  try {
    const { supabase } = await requireUser(request, { role: 'admin' })
    const { page, pageSize, search, params } = listParameters(request)
    const users = await authDirectory(supabase)
    const emails = new Map(users.map(user => [user.id, user.email]))
    let query = supabase.from('nfc_items').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id')
    const type = params.get('type') || 'all'
    const status = params.get('status') || 'all'
    if (!['all', 'card', 'stand', 'round_tag'].includes(type) || !['all', 'active', 'inactive', 'retired'].includes(status)) throw new HttpError(400, 'Invalid item filters.')
    if (type !== 'all') query = query.eq('product_type', type)
    if (status === 'retired') query = query.not('retired_at', 'is', null)
    else if (status !== 'all') query = query.is('retired_at', null).eq('is_active', status === 'active')
    if (search) {
      const matches = users.filter(user => user.email?.toLowerCase().includes(search.toLowerCase())).map(user => user.id)
      query = query.or(`slug.ilike.*${search}*${matches.length ? `,owner_id.in.(${matches.join(',')})` : ''}`)
    }
    const result = await query.range((page - 1) * pageSize, page * pageSize - 1)
    const items = checked(result)
    const stats = checked(await supabase.rpc('analytics_summary', { p_customer: null, p_days: null, p_item: null }))
    const counts = new Map(stats.cards.map(card => [card.id, card.tapCount]))
    return jsonResponse({ items: items.map(item => ({ ...item, ownerEmail: emails.get(item.owner_id) || null,
      tapCount: counts.get(item.id) || 0, url: itemUrl(item.slug) })), total: result.count, page, pageSize })
  } catch (error) { return apiError(error) }
}

export async function POST(request) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'admin' })
    const body = await readJson(request)
    const item = checked(await supabase.rpc('create_nfc_item', { p_actor: user.id, p_owner: uuid(body.ownerId, 'Customer'),
      p_slug: body.slug, p_product_type: body.productType, p_operation_key: uuid(body.operationKey, 'Operation') }))
    return jsonResponse({ item: { ...item, url: itemUrl(item.slug) } }, 201)
  } catch (error) { return apiError(error) }
}
