import { requireUser } from '@/lib/auth'
import { apiError, jsonResponse } from '@/lib/http'
import { checked, analyticsParameters } from '@/lib/data'

export async function GET(request) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'customer' })
    const { days, item } = analyticsParameters(request)
    return jsonResponse(checked(await supabase.rpc('analytics_summary', { p_customer: user.id, p_days: days, p_item: item })))
  } catch (error) { return apiError(error) }
}
