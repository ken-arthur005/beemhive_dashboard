import 'server-only'
import { checked } from './data'

export async function resumeDeletion(supabase, actor, job) {
  if (job.status === 'completed') return job
  job = checked(await supabase.rpc('refresh_deletion_inventory', { p_actor: actor, p_job: job.id }))
  const groups = Map.groupBy(job.object_inventory || [], entry => entry.bucket)
  for (const [bucket, objects] of groups) {
    for (let offset = 0; offset < objects.length; offset += 100) {
      checked(await supabase.storage.from(bucket).remove(objects.slice(offset, offset + 100).map(object => object.object_path)))
    }
  }
  const target = await supabase.auth.admin.getUserById(job.target_user_id)
  if (target.error && target.error.status !== 404 && target.error.code !== 'user_not_found') throw target.error
  if (target.data?.user) {
    const removed = await supabase.auth.admin.deleteUser(job.target_user_id)
    if (removed.error && removed.error.status !== 404 && removed.error.code !== 'user_not_found') throw removed.error
  }
  // A late upload is detected by finalization, then picked up by the refreshed
  // inventory on retry. No stale inventory can strand the cleanup indefinitely.
  checked(await supabase.rpc('finish_customer_deletion', { p_actor: actor, p_job: job.id }))
  return { ...job, status: 'completed' }
}
