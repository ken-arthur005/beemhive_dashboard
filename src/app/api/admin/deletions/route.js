import { requireUser } from '@/lib/auth'
import { checked } from '@/lib/data'
import { apiError, jsonResponse } from '@/lib/http'

export async function GET(request) {
  try {
    const { supabase } = await requireUser(request, { role: 'admin' })
    return jsonResponse({ jobs: checked(await supabase.from('customer_deletions').select('id,status,created_at,last_error')
      .neq('status', 'completed').order('created_at').limit(100)) })
  } catch (error) { return apiError(error) }
}
