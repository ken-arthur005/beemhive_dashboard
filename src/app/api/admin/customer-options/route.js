import { requireUser } from '@/lib/auth'
import { apiError, jsonResponse } from '@/lib/http'
import { customerDirectory, listParameters } from '@/lib/data'

export async function GET(request) {
  try {
    const { supabase } = await requireUser(request, { role: 'admin' })
    const { search } = listParameters(request)
    const customers = (await customerDirectory(supabase)).filter(customer => customer.status === 'active' &&
      `${customer.name} ${customer.email}`.toLowerCase().includes(search.toLowerCase())).slice(0, 50)
    return jsonResponse({ customers: customers.map(({ user_id, name, email }) => ({ user_id, name, email })) })
  } catch (error) { return apiError(error) }
}
