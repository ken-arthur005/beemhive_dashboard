'use client'

import { useEffect, useRef, useState } from 'react'
import { Shuffle, Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { itemUrl } from '@/lib/platform'
import CustomerSelector from './customer-selector'
import { adminRequest } from './admin-api'
import { inputClass, primaryClass, Notice } from './admin-controls'

const STORAGE_KEY = 'beem_admin_pending_creation_v1'
const emptyFields = { customerName: '', email: '', confirmEmail: '', productType: 'card', slug: '' }

export default function CreateNfcItemModal({ open, onOpenChange, onCreated }) {
  const [mode, setMode] = useState('existing')
  const [customer, setCustomer] = useState(null)
  const [fields, setFields] = useState(emptyFields)
  const [pending, setPending] = useState(null)
  const operationRef = useRef(null)
  const busyRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [created, setCreated] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        if (saved?.body?.operationKey && ['existing', 'invite'].includes(saved.mode)) {
          operationRef.current = saved
          setPending(saved)
          setMode(saved.mode)
          setFields({ ...emptyFields, ...saved.body, confirmEmail: saved.body.email || '' })
          setCustomer(saved.customer || null)
        }
      } catch {
        setError('The saved request could not be restored. Check existing items before creating another request.')
      }
    })
    return () => { cancelled = true }
  }, [open])

  function update(name, value) {
    setFields(previous => ({ ...previous, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (busyRef.current) return
    if (!operationRef.current && mode === 'invite' && fields.email.toLowerCase() !== fields.confirmEmail.toLowerCase()) {
      setError('The email addresses must match.')
      return
    }
    if (!operationRef.current && mode === 'existing' && !customer) {
      setError('Choose an existing customer.')
      return
    }
    busyRef.current = true
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      let operation = operationRef.current
      if (!operation) {
        const body = { operationKey: crypto.randomUUID(), slug: fields.slug.trim(), productType: fields.productType }
        if (mode === 'existing') body.ownerId = customer.user_id
        else Object.assign(body, { email: fields.email.trim(), customerName: fields.customerName.trim() })
        operation = { mode, body, customer }
        // Persist before sending: an invite may provision a user before a response is lost.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(operation))
        operationRef.current = operation
        setPending(operation)
      }
      const data = await adminRequest(operation.mode === 'existing' ? '/api/admin/nfc-items' : '/api/invite', { method: 'POST', body: operation.body })
      if (!data.item?.slug) throw new Error('Creation is not confirmed. Retry this saved request to confirm the result.')
      localStorage.removeItem(STORAGE_KEY)
      operationRef.current = null
      setPending(null)
      setCreated(data.item)
      onCreated(data.item)
    } catch (error) {
      setError(error.message)
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }

  function close(nextOpen) {
    if (busyRef.current) return
    onOpenChange(nextOpen)
    if (!nextOpen && created) {
      setCreated(null)
      setFields(emptyFields)
      setCustomer(null)
      setError('')
      setMessage('')
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(itemUrl(created.slug))
      setMessage('Canonical URL copied.')
    } catch { setError('Could not copy the URL. Select and copy it manually.') }
  }

  const locked = submitting || !!pending
  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto" showCloseButton={!submitting}>
      <DialogHeader>
        <DialogTitle>{created ? 'NFC item created' : 'Create NFC Item'}</DialogTitle>
        <DialogDescription>{created ? 'The item URL is ready for programming. Public access requires an eligible owner and a published profile.' : 'Assign an existing customer or invite a new customer.'}</DialogDescription>
      </DialogHeader>
      {created ? <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
          <code className="min-w-0 flex-1 break-all text-xs select-all">{itemUrl(created.slug)}</code>
          <button type="button" aria-label="Copy canonical URL" title="Copy canonical URL" onClick={copyUrl}><Copy size={16} /></button>
        </div>
        <p className="text-sm text-gray-500">Open NFC Tools → Write → URL → paste this URL → tap the physical item.</p>
        <Button className={primaryClass} onClick={() => close(false)}>Done</Button>
      </div> : <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm font-medium">Customer assignment
          <select className={inputClass} value={mode} disabled={locked} onChange={event => setMode(event.target.value)}>
            <option value="existing">Existing customer</option><option value="invite">Invite new customer</option>
          </select>
        </label>
        {mode === 'existing' ? <CustomerSelector value={customer} onChange={setCustomer} disabled={locked} /> : <>
          <label className="block space-y-1 text-sm font-medium">Customer name<input className={inputClass} value={fields.customerName} required minLength={2} maxLength={100} disabled={locked} onChange={event => update('customerName', event.target.value)} /></label>
          <label className="block space-y-1 text-sm font-medium">Email<input className={inputClass} type="email" value={fields.email} required maxLength={254} disabled={locked} onChange={event => update('email', event.target.value)} /></label>
          <label className="block space-y-1 text-sm font-medium">Confirm email<input className={inputClass} type="email" value={fields.confirmEmail} required disabled={locked} onChange={event => update('confirmEmail', event.target.value)} /></label>
        </>}
        <label className="block space-y-1 text-sm font-medium">Product type<select className={inputClass} value={fields.productType} disabled={locked} onChange={event => update('productType', event.target.value)}><option value="card">Card</option><option value="stand">Stand</option><option value="round_tag">Round Tag</option></select></label>
        <div className="space-y-1">
          <label htmlFor="admin-new-slug" className="text-sm font-medium">Slug</label>
          <div className="flex gap-2"><input id="admin-new-slug" className={inputClass} value={fields.slug} required minLength={3} maxLength={30} pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={locked} onChange={event => update('slug', event.target.value)} /><Button type="button" variant="outline" size="icon" disabled={locked} aria-label="Generate slug" title="Generate slug" onClick={() => update('slug', crypto.randomUUID().slice(0, 8))}><Shuffle size={16} /></Button></div>
          <p className="text-xs text-gray-500">3–30 lowercase letters, numbers or hyphens. This physical URL stays stable.</p>
        </div>
        {pending && <p className="text-xs text-gray-500 break-all">Saved operation: {pending.body.operationKey}. Retry uses the same request, including any customer already provisioned.</p>}
        <p role="status" className="text-sm text-gray-500">{submitting ? 'Waiting for the API to confirm creation…' : pending ? 'Creation is not yet confirmed. Retry the saved request.' : 'New invitations require the customer to complete setup and publish before their profile is public.'}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={submitting} onClick={() => close(false)}>{pending ? 'Close — keep request' : 'Cancel'}</Button><Button className={primaryClass} type="submit" disabled={submitting}>{submitting ? 'Creating…' : pending ? 'Retry creation' : 'Create item'}</Button></div>
      </form>}
      <Notice error={error} message={message} />
    </DialogContent>
  </Dialog>
}
