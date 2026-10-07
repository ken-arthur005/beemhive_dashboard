import { requireUser } from '@/lib/auth'
import { checked, uuid } from '@/lib/data'
import { apiError, HttpError, jsonResponse } from '@/lib/http'
import { resumeDeletion } from '@/lib/deletions'

export async function POST(request, { params }) {
  let job
  let service
  try {
    const { user, supabase } = await requireUser(request, { role: 'admin' })
    service = supabase
    const { id } = await params
    job = checked(await supabase.from('customer_deletions').select('*').eq('id', uuid(id)).maybeSingle())
    if (!job) throw new HttpError(404, 'Cleanup job not found.')
    await resumeDeletion(supabase, user.id, job)
    return jsonResponse({ success: true, jobId: job.id })
  } catch (error) {
    if (job && service) {
      await service.from('customer_deletions').update({ status: 'failed', last_error: 'Cleanup requires a retry.' }).eq('id', job.id).neq('status', 'completed')
      return jsonResponse({ error: 'Cleanup remains pending. Retry this job.', jobId: job.id, jobStatus: 'failed' }, 503)
    }
    return apiError(error)
  }
}
