'use client'

import { useEffect, useState } from 'react'
import { adminRequest } from './admin-api'

export default function PendingCleanups() {
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  async function load() {
    try { const result = await adminRequest('/api/admin/deletions'); setJobs(result.jobs); setError('') }
    catch (failure) { setError(failure.message) }
  }
  useEffect(() => { let alive = true; adminRequest('/api/admin/deletions').then(result => { if (alive) setJobs(result.jobs) })
    .catch(failure => { if (alive) setError(failure.message) }); return () => { alive = false } }, [])
  async function resume(id) {
    setBusy(id)
    try { await adminRequest(`/api/admin/deletions/${id}`, { method: 'POST' }); await load() }
    catch (failure) { setError(failure.message) }
    finally { setBusy(null) }
  }
  if (!jobs.length && !error) return null
  return <section className="rounded-xl border border-amber-200 p-4 space-y-3" aria-label="Pending customer cleanup jobs">
    <h2 className="font-semibold text-sm">Pending customer cleanup</h2>
    <p className="text-xs text-gray-500">These already-approved deletion jobs can be resumed even after the account has been removed.</p>
    {error && <p role="alert" className="text-sm text-rose-600">{error} <button type="button" onClick={load} className="underline">Reload jobs</button></p>}
    {jobs.map(job => <div key={job.id} className="flex flex-wrap items-center gap-3 text-xs">
      <code className="break-all">{job.id}</code><span>{job.status}</span>
      <button type="button" disabled={Boolean(busy)} onClick={() => resume(job.id)} className="rounded-lg border px-3 py-2 disabled:opacity-50">{busy === job.id ? 'Cleaning up…' : 'Resume cleanup'}</button>
    </div>)}
  </section>
}
