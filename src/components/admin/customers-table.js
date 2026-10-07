'use client'

import { Fragment, useRef, useState } from 'react'
import { MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { itemUrl } from '@/lib/platform'
import { adminRequest, requireCompletedDeletion } from './admin-api'
import { useAdminList, useDebouncedSearch } from './use-admin-list'
import { inputClass, cellClass, cardClass, primaryClass, Notice, ListState, Pagination, formatDate } from './admin-controls'
import PendingCleanups from './pending-cleanups'

export function customerProfileState(customer) {
  if (!customer.setup_completed_at) return 'Setup required'
  return customer.published_revision != null ? 'Published' : 'Draft'
}

export default function CustomersTable() {
  const [filters, setFilters] = useState({ search: '', status: 'all', sort: 'newest', page: 1 })
  const search = useDebouncedSearch(filters.search)
  const list = useAdminList('/api/admin/customers', 'customers', { ...filters, search })
  const [expanded, setExpanded] = useState(null)
  const [action, setAction] = useState(null)
  const [reason, setReason] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [job, setJob] = useState(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')

  function filter(name, value) { setFilters(previous => ({ ...previous, [name]: value, page: 1 })) }
  function prepare(customer, type) {
    setAction({ customer, type })
    setConfirmEmail('')
    setReason('')
    setJob(null)
    setActionError('')
  }

  async function resend(customer) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await adminRequest('/api/invite', { method: 'POST', body: { mode: 'resend', userId: customer.user_id } })
      if (data.success !== true) throw new Error('Invitation resend is not confirmed. Please retry.')
      setMessage('The API confirmed the setup invitation was resent.')
    } catch (error) { setError(error.message) }
    finally { busyRef.current = false; setBusy(false) }
  }

  async function submit(event) {
    event.preventDefault()
    if (!action || busyRef.current) return
    const deleting = action.type === 'delete'
    if (deleting && confirmEmail !== action.customer.email) { setActionError('Enter the exact customer email to confirm.'); return }
    busyRef.current = true
    setBusy(true)
    setActionError('')
    setError('')
    setMessage('')
    try {
      const data = await adminRequest(`/api/admin/customers/${encodeURIComponent(action.customer.user_id)}`, {
        method: deleting ? 'DELETE' : 'PATCH',
        body: deleting ? { confirmEmail } : { status: action.type, reason: reason.trim() },
      })
      if (deleting) {
        requireCompletedDeletion(data)
        setMessage(`Customer cleanup completed${data.jobId ? ` (job ${data.jobId})` : ''}. Items are retired; their physical URLs are preserved.`)
      } else {
        if (!data.account) throw new Error('The account update is not confirmed. Reload its status before retrying.')
        setMessage(action.type === 'suspended' ? 'Customer suspended. Public access is blocked.' : 'Customer reinstated. Setup and publication still determine public access.')
      }
      setAction(null)
      list.reload()
    } catch (error) {
      if (deleting) {
        setJob({ id: error.jobId || job?.id, status: error.jobStatus || 'Completion unconfirmed' })
        setActionError(`${error.message} Cleanup is not confirmed complete. Retry resumes deletion for this customer.`)
      } else setActionError(error.message)
      list.reload()
    } finally { busyRef.current = false; setBusy(false) }
  }

  async function copy(slug) {
    setError('')
    setMessage('')
    try { await navigator.clipboard.writeText(itemUrl(slug)); setMessage('Canonical URL copied.') }
    catch { setError(`Could not copy. Copy this URL manually: ${itemUrl(slug)}`) }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-semibold">Customers</h1><p className="mt-0.5 text-sm text-gray-500">Manage account access, setup and publication independently</p></div><span className="text-xs text-gray-500">{list.loading ? 'Loading…' : `${list.total} matching customers`}</span></div>
    <Notice error={error} message={message} />
    <PendingCleanups />
    {busy && !action && <p role="status" className="text-sm text-gray-500">Waiting for API confirmation…</p>}
    <div className={cardClass}>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <input type="search" aria-label="Search customers" className={`${inputClass} flex-1 min-w-40`} placeholder="Search customers…" value={filters.search} onChange={event => filter('search', event.target.value)} />
        <select aria-label="Account status filter" className={`${inputClass} w-auto`} value={filters.status} onChange={event => filter('status', event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deleting">Deleting</option></select>
        <select aria-label="Sort customers" className={`${inputClass} w-auto`} value={filters.sort} onChange={event => filter('sort', event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="nfc_count">Most NFC items</option></select>
      </div>
      <ListState list={list} noun="customers" />
      {!list.loading && !list.error && list.rows.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500">{['Customer', 'NFC Items', 'Account', 'Profile', 'Last Login', 'Joined', 'Actions'].map(label => <th scope="col" className={cellClass} key={label}>{label}</th>)}</tr></thead>
        <tbody>{list.rows.map(customer => {
          const items = customer.nfc_items || []
          const open = expanded === customer.user_id
          return <Fragment key={customer.user_id}>
            <tr className="border-b border-gray-100 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <td className={cellClass}><button type="button" className="flex items-center gap-2 text-left rounded focus-visible:ring-2 focus-visible:ring-amber-400" aria-expanded={open} aria-controls={`customer-${customer.user_id}`} onClick={() => setExpanded(open ? null : customer.user_id)}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}<span className="max-w-52 truncate"><span className="block font-medium">{customer.name || customer.email}</span><span className="block text-xs text-gray-500">{customer.email}</span></span></button></td>
              <td className={cellClass}>{customer.nfc_item_count ?? items.length}</td>
              <td className={cellClass}><span className={`rounded-full px-2 py-0.5 text-xs ${customer.status === 'active' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>{customer.status === 'active' ? 'Active' : customer.status === 'suspended' ? 'Suspended' : customer.status === 'deleting' ? 'Deleting' : 'Unknown'}</span></td>
              <td className={cellClass}>{customerProfileState(customer)}</td>
              <td className={cellClass}>{customer.last_sign_in_at ? formatDate(customer.last_sign_in_at) : 'Never logged in'}</td><td className={cellClass}>{formatDate(customer.created_at)}</td>
              <td className={cellClass}><DropdownMenu>
                <DropdownMenuTrigger render={<button type="button" aria-label={`Actions for ${customer.email}`} title={`Actions for ${customer.email}`} disabled={busy} className="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-800" />}><MoreHorizontal size={16} /></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setExpanded(open ? null : customer.user_id)}>View customer details</DropdownMenuItem>
                  <DropdownMenuItem disabled={customer.status !== 'active'} onClick={() => resend(customer)}>Resend setup invitation</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={!['active', 'suspended'].includes(customer.status)} onClick={() => prepare(customer, customer.status === 'suspended' ? 'active' : 'suspended')}>{customer.status === 'suspended' ? 'Reinstate customer' : 'Suspend customer'}</DropdownMenuItem>
                  <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" disabled={!customer.email} onClick={() => prepare(customer, 'delete')}>{customer.status === 'deleting' ? 'Resume permanent deletion' : 'Permanently delete customer'}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu></td>
            </tr>
            {open && <tr id={`customer-${customer.user_id}`}><td colSpan={7} className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  {customer.photo_url && (
                    // Authenticated image delivery intentionally bypasses public optimization caches.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={customer.photo_url} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  )}
                  <div><p className="text-xs font-medium text-gray-500">Private draft profile</p>
                    {customer.title && <p className="mt-1 text-sm font-medium">{customer.title}</p>}
                    {customer.bio && <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-600 dark:text-gray-300">{customer.bio}</p>}
                  </div>
                </div>
                <p className="text-sm">Setup: {customer.setup_completed_at ? `Completed ${formatDate(customer.setup_completed_at)}` : 'Required'} · Publication: {customer.published_revision != null ? `Published revision ${customer.published_revision}` : 'Unpublished draft'}</p>
                <p className="text-xs text-gray-500">Account access and profile publication are separate. Item access also depends on its active state.</p>
                <div className="flex flex-wrap gap-2">{items.map(item => <Button key={item.id || item.slug} type="button" variant="outline" size="sm" onClick={() => copy(item.slug)}><span className="font-mono text-xs">/t/{item.slug}</span><span>{item.retired_at ? 'Retired' : item.is_active ? 'Active' : 'Paused'}</span><span className="sr-only">Copy canonical URL</span></Button>)}</div>
                {!items.length && <p className="text-xs text-gray-500">No NFC items assigned.</p>}
              </div>
            </td></tr>}
          </Fragment>
        })}</tbody>
      </table></div>}
      {!list.error && <Pagination list={list} onPage={page => setFilters(previous => ({ ...previous, page }))} />}
    </div>
    <Dialog open={!!action} onOpenChange={open => { if (!open && !busyRef.current) setAction(null) }}>
      <DialogContent showCloseButton={!busy} className="sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader><DialogTitle>{action?.type === 'delete' ? 'Permanently delete customer?' : action?.type === 'suspended' ? 'Suspend customer?' : 'Reinstate customer?'}</DialogTitle>
          <DialogDescription>{action?.type === 'delete' ? 'This permanently removes the customer’s personal information, profile media and account. Their NFC items are retired and unassigned; physical URLs and anonymized tap history are preserved. This cannot be undone. Cleanup may need a retry if any step fails.' : action?.type === 'suspended' ? 'Suspension blocks customer access and public profiles. It does not delete the customer or change physical URLs.' : 'Reinstatement restores account access. Setup, publication and each item’s active state still control public access.'}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="break-all text-sm font-medium">{action?.customer.email}</p>
          {action?.type === 'delete' ? <label className="block space-y-1 text-sm">Confirm customer email<input className={inputClass} type="email" autoComplete="off" required value={confirmEmail} disabled={busy} onChange={event => setConfirmEmail(event.target.value)} /></label> : <label className="block space-y-1 text-sm">Reason (optional)<input className={inputClass} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>}
          {job && <p role="status" className="text-xs break-all">Deletion job {job.id || '(ID not returned)'}: {job.status}. Retry uses this customer’s existing cleanup job.</p>}
          <Notice error={actionError} />
          {busy && <p role="status" className="text-sm text-gray-500">{action?.type === 'delete' ? 'Cleanup in progress. Waiting for the API to confirm every deletion step…' : 'Waiting for the API to confirm account status…'}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setAction(null)}>Close</Button><Button type="submit" className={action?.type === 'delete' ? undefined : primaryClass} variant={action?.type === 'delete' ? 'destructive' : 'default'} disabled={busy || (action?.type === 'delete' && confirmEmail !== action.customer.email)}>{busy ? 'Waiting…' : action?.type === 'delete' ? job ? 'Retry cleanup' : 'Permanently delete' : 'Confirm'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>
}
