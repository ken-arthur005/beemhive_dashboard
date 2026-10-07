import { requireUser } from '@/lib/auth'
import { apiError, HttpError, jsonResponse, readJson } from '@/lib/http'
import { checked, uuid } from '@/lib/data'
import { resumeDeletion } from '@/lib/deletions'

export async function PATCH(request, { params }) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'admin' })
    const { id } = await params
    const body = await readJson(request)
    return jsonResponse({ account: checked(await supabase.rpc('set_customer_status', { p_actor: user.id,
      p_user: uuid(id), p_status: body.status, p_reason: body.reason || '' })) })
  } catch (error) { return apiError(error) }
}

export async function DELETE(request, { params }) {
  let job
  let service
  try {
    const { user, supabase } = await requireUser(request, { role: 'admin' })
    service = supabase
    const { id } = await params
    uuid(id)
    const { confirmEmail } = await readJson(request)
    const target = await supabase.auth.admin.getUserById(id)
    // A retry can resume after Auth deletion using the original job, without
    // relying on a now-removed role/profile or claiming cleanup was completed.
    if (target.error && target.error.status !== 404 && target.error.code !== 'user_not_found') throw target.error
    if (!target.data?.user) {
      job = checked(await supabase.from('customer_deletions').select('*').eq('target_user_id', id).neq('status', 'completed').maybeSingle())
      if (!job) {
        const absent = checked(await supabase.rpc('verify_customer_absent', { p_user: id }))
        if (!absent) throw new HttpError(409, 'Account cleanup is not complete. Review pending cleanup jobs.', 'deletion_retry')
        return jsonResponse({ success: true, alreadyRemoved: true })
      }
    } else {
      if (typeof confirmEmail !== 'string' || confirmEmail !== target.data.user.email) throw new HttpError(400, 'Enter the exact customer email to confirm permanent deletion.')
      job = checked(await supabase.rpc('begin_customer_deletion', { p_actor: user.id, p_user: id }))
    }
    await resumeDeletion(supabase, user.id, job)
    return jsonResponse({ success: true, jobId: job.id })
  } catch (error) {
    if (job && service) {
      await service.from('customer_deletions').update({ status: 'failed', last_error: 'Cleanup requires a retry.' }).eq('id', job.id).neq('status', 'completed')
      return jsonResponse({ error: 'Cleanup is not complete. The account remains blocked; retry resumes this job.',
        code: 'deletion_retry', jobId: job.id, jobStatus: 'failed' }, 503)
    }
    return apiError(error)
  }
}
