import { requireUser } from '@/lib/auth'
import { apiError, jsonResponse } from '@/lib/http'
import { checked, analyticsParameters } from '@/lib/data'

export async function GET(request) {
  try {
    const { supabase } = await requireUser(request, { role: 'admin' })
    const { days, item } = analyticsParameters(request)
    const [summary, items, customers] = await Promise.all([
      supabase.rpc('analytics_summary', { p_customer: null, p_days: days, p_item: item }).then(checked),
      supabase.from('nfc_items').select('id', { count: 'exact', head: true }),
      supabase.from('users_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'customer'),
    ])
    checked(items); checked(customers)
    return jsonResponse({ ...summary, todayCount: summary.todayTaps, totalItems: items.count,
      totalCustomers: customers.count, current: summary.totalTaps, previous: summary.previousTaps })
  } catch (error) { return apiError(error) }
}
