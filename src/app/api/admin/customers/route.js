import { requireUser } from '@/lib/auth'
import { apiError, jsonResponse, HttpError } from '@/lib/http'
import { customerDirectory, listParameters } from '@/lib/data'

export async function GET(request) {
  try {
    const { supabase } = await requireUser(request, { role: 'admin' })
    const { page, pageSize, search, params } = listParameters(request)
    const status = params.get('status') || 'all'
    const sort = params.get('sort') || 'newest'
    if (!['all', 'active', 'suspended', 'deleting'].includes(status) || !['newest', 'oldest', 'name', 'nfc_count'].includes(sort)) throw new HttpError(400, 'Invalid customer filters.')
    const customers = (await customerDirectory(supabase)).filter(customer => (!search ||
      `${customer.name} ${customer.email}`.toLowerCase().includes(search.toLowerCase())) && (status === 'all' || customer.status === status))
    customers.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'nfc_count' ? b.nfc_item_count - a.nfc_item_count :
      (Date.parse(a.created_at) - Date.parse(b.created_at)) * (sort === 'oldest' ? 1 : -1))
    return jsonResponse({ customers: customers.slice((page - 1) * pageSize, page * pageSize), total: customers.length, page, pageSize })
  } catch (error) { return apiError(error) }
}
