'use client'

import { useRef, useState } from 'react'
import { Plus, Copy, MoreHorizontal } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { itemUrl } from '@/lib/platform'
import CreateNfcItemModal from './create-nfc-item-modal'
import CustomerSelector from './customer-selector'
import { adminRequest } from './admin-api'
import { useAdminList, useDebouncedSearch } from './use-admin-list'
import { inputClass, cellClass, cardClass, primaryClass, Notice, ListState, Pagination, formatDate } from './admin-controls'

const PRODUCT_LABELS = { card: 'Card', stand: 'Stand', round_tag: 'Round Tag' }
const PRODUCT_BADGES = { card: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', stand: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', round_tag: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }

export default function NfcItemsTable() {
  const [filters, setFilters] = useState({ search: '', type: 'all', status: 'all', page: 1 })
  const search = useDebouncedSearch(filters.search)
  const list = useAdminList('/api/admin/nfc-items', 'items', { ...filters, search })
  const [createOpen, setCreateOpen] = useState(false)
  const [action, setAction] = useState(null)
  const [target, setTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')

  function filter(name, value) { setFilters(previous => ({ ...previous, [name]: value, page: 1 })) }
  function prepare(item, name) {
    setAction({ item, name })
    setTarget(null)
    setReason('')
    setActionError('')
  }

  async function mutate(event) {
    event.preventDefault()
    if (busyRef.current || !action) return
    if (action.name === 'transfer' && !target) { setActionError('Choose the new owner.'); return }
    busyRef.current = true
    setBusy(action.item.id)
    setActionError('')
    setError('')
    setMessage('')
    try {
      const body = { action: action.name, version: action.item.version, reason: reason.trim() }
      if (action.name === 'transfer') body.targetOwnerId = target.user_id
      const data = await adminRequest(`/api/admin/nfc-items/${encodeURIComponent(action.item.id)}`, { method: 'PATCH', body })
      if (!data.item) throw new Error('The item update is not confirmed. Reload its status before retrying.')
      setMessage(action.name === 'transfer' ? 'Ownership transferred. The item is paused and its physical URL is unchanged.' : `Item ${action.name === 'retire' ? 'retired; its URL and history are preserved' : action.name === 'activate' ? 'activated' : 'paused'}.`)
      setAction(null)
      list.reload()
    } catch (error) {
      setActionError(error.status === 409 ? `${error.message} Reloaded the list; close this dialog and review the latest item before retrying.` : error.message)
      list.reload()
    } finally {
      busyRef.current = false
      setBusy('')
    }
  }

  async function copy(item) {
    setError('')
    setMessage('')
    try { await navigator.clipboard.writeText(itemUrl(item.slug)); setMessage('Canonical URL copied.') }
    catch { setError(`Could not copy. Copy this URL manually: ${itemUrl(item.slug)}`) }
  }

  async function resend(item) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(item.id)
    setError('')
    setMessage('')
    try {
      const data = await adminRequest('/api/invite', { method: 'POST', body: { mode: 'resend', userId: item.owner_id } })
      if (data.success !== true) throw new Error('Invitation resend is not confirmed. Please retry.')
      setMessage('The API confirmed the setup invitation was resent.')
    } catch (error) { setError(error.message) }
    finally { busyRef.current = false; setBusy('') }
  }

  async function downloadQr(item) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(item.id)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/qr?${new URLSearchParams({ slug: item.slug })}`, { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data.error === 'string' ? data.error : 'QR download failed. Please retry.')
      }
      if (!response.headers.get('content-type')?.includes('image/png')) throw new Error('The API did not return a QR image. Please retry.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `${item.slug}-qr.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('QR download started. A QR code does not make an inactive or unpublished profile public.')
    } catch (error) { setError(error.message) }
    finally { busyRef.current = false; setBusy('') }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-xl font-semibold">NFC Items</h1><p className="mt-0.5 text-sm text-gray-500">Manage your NFC products and customer assignments</p></div>
      <Button className={primaryClass} onClick={() => setCreateOpen(true)}><Plus size={16} />Create NFC Item</Button>
    </div>
    <Notice error={error} message={message} />
    {busy && <p role="status" className="text-sm text-gray-500">Waiting for API confirmation…</p>}
    <div className={cardClass}>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <input type="search" aria-label="Search NFC items" placeholder="Search by customer or slug…" className={`${inputClass} flex-1 min-w-40`} value={filters.search} onChange={event => filter('search', event.target.value)} />
        <select aria-label="Product type filter" className={`${inputClass} w-auto`} value={filters.type} onChange={event => filter('type', event.target.value)}><option value="all">All types</option>{Object.entries(PRODUCT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="Item status filter" className={`${inputClass} w-auto`} value={filters.status} onChange={event => filter('status', event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Paused</option><option value="retired">Retired</option></select>
      </div>
      <ListState list={list} noun="items" />
      {!list.loading && !list.error && list.rows.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500">{['Product', 'Customer', 'Slug', 'Status', 'Taps', 'Created', 'Actions'].map(label => <th scope="col" key={label} className={cellClass}>{label}</th>)}</tr></thead>
        <tbody>{list.rows.map(item => {
          const retired = !!item.retired_at || item.status === 'retired'
          return <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <td className={cellClass}><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRODUCT_BADGES[item.product_type] || ''}`}>{PRODUCT_LABELS[item.product_type] || item.product_type}</span></td>
            <td className={`${cellClass} max-w-48 truncate`} title={item.ownerEmail || ''}>{item.ownerEmail || 'Unassigned'}</td>
            <td className={cellClass}><div className="flex items-center gap-2"><code className="text-xs">{item.slug}</code><button type="button" className="p-1 rounded focus-visible:ring-2 focus-visible:ring-amber-400" aria-label={`Copy canonical URL for ${item.slug}`} title="Copy canonical URL" onClick={() => copy(item)}><Copy size={14} /></button></div></td>
            <td className={cellClass}><div className="flex items-center gap-2"><span>{retired ? 'Retired' : item.is_active ? 'Active' : 'Paused'}</span><Switch checked={!retired && !!item.is_active} disabled={retired || !!busy} aria-label={`${item.is_active ? 'Pause' : 'Activate'} ${item.slug}`} onCheckedChange={() => prepare(item, item.is_active ? 'deactivate' : 'activate')} /></div><span className="text-xs text-gray-500">Public access requires setup + publication</span></td>
            <td className={cellClass}>{item.tapCount ?? '—'}</td><td className={cellClass}>{formatDate(item.created_at)}</td>
            <td className={cellClass}><DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" disabled={!!busy} aria-label={`Actions for ${item.slug}`} title={`Actions for ${item.slug}`} className="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-800" />}><MoreHorizontal size={16} /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => copy(item)}>Copy canonical URL</DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadQr(item)}>Download QR (may be inactive/unpublished)</DropdownMenuItem>
                <DropdownMenuItem disabled={!item.owner_id || retired} onClick={() => resend(item)}>Resend setup invitation</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={retired} onClick={() => prepare(item, item.is_active ? 'deactivate' : 'activate')}>{item.is_active ? 'Pause item' : 'Activate item'}</DropdownMenuItem>
                <DropdownMenuItem disabled={retired} onClick={() => prepare(item, 'transfer')}>Transfer ownership</DropdownMenuItem>
                <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" disabled={retired} onClick={() => prepare(item, 'retire')}>Retire item</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu></td>
          </tr>
        })}</tbody>
      </table></div>}
      {!list.error && <Pagination list={list} onPage={page => setFilters(previous => ({ ...previous, page }))} />}
    </div>
    <Dialog open={!!action} onOpenChange={open => { if (!open && !busyRef.current) setAction(null) }}>
      <DialogContent showCloseButton={!busy} className="sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader><DialogTitle>{action?.name === 'transfer' ? 'Transfer ownership' : action?.name === 'retire' ? 'Retire NFC item?' : action?.name === 'activate' ? 'Activate NFC item?' : 'Pause NFC item?'}</DialogTitle>
          <DialogDescription>{action?.name === 'transfer' ? 'Choose an existing customer. Transfer pauses the item, closes its previous assignment and preserves its physical URL and tap history.' : action?.name === 'retire' ? 'Retirement disables public access permanently. The physical URL and tap history are preserved; the record is not deleted.' : action?.name === 'activate' ? 'Activation requires an active owner with completed setup and a published profile. The API will check eligibility.' : 'Public access will be paused. Its physical URL and history stay unchanged.'}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={mutate}>
          <code className="block break-all text-xs">{action && itemUrl(action.item.slug)}</code>
          {action?.name === 'transfer' && <CustomerSelector value={target} onChange={setTarget} excludeId={action.item.owner_id} disabled={!!busy} />}
          <label className="block space-y-1 text-sm">Reason (optional)<input className={inputClass} maxLength={500} value={reason} disabled={!!busy} onChange={event => setReason(event.target.value)} /></label>
          <Notice error={actionError} />
          {busy && <p role="status" className="text-sm text-gray-500">Waiting for the API to confirm the item update…</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={!!busy} onClick={() => setAction(null)}>Cancel</Button><Button type="submit" className={action?.name === 'retire' ? undefined : primaryClass} disabled={!!busy || (action?.name === 'transfer' && !target)} variant={action?.name === 'retire' ? 'destructive' : 'default'}>{busy ? 'Updating…' : action?.name === 'transfer' ? 'Transfer and pause' : action?.name === 'retire' ? 'Retire item' : 'Confirm'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <CreateNfcItemModal open={createOpen} onOpenChange={setCreateOpen} onCreated={() => { list.reload(); setMessage('The API confirmed the NFC item was created.'); setError('') }} />
  </div>
}
