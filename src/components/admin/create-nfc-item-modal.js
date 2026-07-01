'use client'

import { useState, useCallback } from 'react'
import { Shuffle, Copy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const EMPTY_FIELDS = { customerName: '', customerEmail: '', confirmEmail: '', productType: '', slug: '' }
const EMPTY_TOUCHED = { customerName: false, customerEmail: false, confirmEmail: false, productType: false, slug: false }

function validate(fields, touched) {
  const errors = {}
  if (touched.customerName) {
    if (!fields.customerName) errors.customerName = 'Name is required'
    else if (fields.customerName.length < 2) errors.customerName = 'Name must be at least 2 characters'
  }
  if (touched.customerEmail) {
    if (!fields.customerEmail) errors.customerEmail = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.customerEmail)) errors.customerEmail = 'Enter a valid email address'
  }
  if (touched.productType && !fields.productType) {
    errors.productType = 'Select a product type'
  }
  if (touched.slug) {
    if (!fields.slug) errors.slug = 'Slug is required'
    else if (fields.slug.length < 3) errors.slug = 'Slug must be at least 3 characters'
    else if (fields.slug.length > 30) errors.slug = 'Slug must be 30 characters or less'
    else if (!/^[a-z0-9-]+$/.test(fields.slug)) errors.slug = 'Only lowercase letters, numbers, and hyphens'
    else if (fields.slug.startsWith('-') || fields.slug.endsWith('-')) errors.slug = 'Cannot start or end with a hyphen'
  }
  return errors
}

function mapApiError(err, code) {
  if (!err) return 'Something went wrong. Please try again.'
  if (err === 'slug_taken') return 'This slug is already taken — try another.'
  if (code === 'over_email_send_rate_limit') return 'Email rate limit reached. Wait a few minutes and try again.'
  if (err.includes('already registered') || err.includes('already been registered')) return 'This email is already registered.'
  return 'Something went wrong. Please try again.'
}

export default function CreateNfcItemModal({ open, onOpenChange, onCreated }) {
  const [step, setStep] = useState('form')
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [touched, setTouched] = useState(EMPTY_TOUCHED)
  const [submitting, setSubmitting] = useState(false)
  const [errorBanner, setErrorBanner] = useState(null)
  const [slugFieldError, setSlugFieldError] = useState(null)
  const [urlCopied, setUrlCopied] = useState(false)
  const [createdSlug, setCreatedSlug] = useState('')

  const errors = validate(fields, touched)
  const confirmMismatch =
    fields.confirmEmail.length > 0 &&
    fields.customerEmail.toLowerCase() !== fields.confirmEmail.toLowerCase()

  function setField(name, value) {
    setFields(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'customerEmail' && prev.confirmEmail !== '') {
        next.confirmEmail = ''
      }
      return next
    })
    if (name === 'customerEmail') {
      setTouched(prev => ({ ...prev, confirmEmail: false }))
    }
  }

  function touch(name) {
    setTouched(prev => ({ ...prev, [name]: true }))
  }

  function generateSlug() {
    const random = Math.random().toString(36).slice(2, 8)
    setField('slug', random)
    setTouched(prev => ({ ...prev, slug: true }))
    setSlugFieldError(null)
  }

  const handleSlugChange = useCallback((e) => {
    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setField('slug', sanitized)
    setSlugFieldError(null)
  }, [])

  async function handleSubmit() {
    const allTouched = { customerName: true, customerEmail: true, confirmEmail: true, productType: true, slug: true }
    setTouched(allTouched)
    const errs = validate(fields, allTouched)
    if (Object.keys(errs).length > 0) return
    if (fields.customerEmail.toLowerCase() !== fields.confirmEmail.toLowerCase()) return

    setSubmitting(true)
    setErrorBanner(null)
    setSlugFieldError(null)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    let res, json
    try {
      res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: fields.customerEmail,
          customerName: fields.customerName,
          productType: fields.productType,
          slug: fields.slug,
        }),
      })
      json = await res.json()
    } catch {
      setErrorBanner('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    if (!res.ok) {
      if (res.status === 409 || json.error === 'slug_taken') {
        setSlugFieldError('This slug is already taken — try another')
      } else {
        setErrorBanner(mapApiError(json.error, json.code))
      }
      setSubmitting(false)
      return
    }

    setCreatedSlug(json.item.slug)
    setStep('success')
    setTimeout(() => {
      onCreated(json.item)
    }, 1500)
  }

  function handleOpenChange(isOpen) {
    onOpenChange(isOpen)
    if (!isOpen) {
      setTimeout(() => {
        setStep('form')
        setFields(EMPTY_FIELDS)
        setTouched(EMPTY_TOUCHED)
        setSubmitting(false)
        setErrorBanner(null)
        setSlugFieldError(null)
        setUrlCopied(false)
        setCreatedSlug('')
      }, 200)
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(`https://beemhive.com/t/${createdSlug}`)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 1500)
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
  const errorClass = 'mt-1 text-xs text-rose-500'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={step === 'form'}>
        {step === 'success' ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/20">
              <style>{`
                @keyframes checkmark {
                  0% { height: 0; width: 0; opacity: 0; }
                  40% { height: 60%; width: 0; opacity: 1; }
                  100% { height: 60%; width: 30%; opacity: 1; }
                }
                .checkmark-line {
                  display: block;
                  width: 30%;
                  height: 60%;
                  border-bottom: 2.5px solid #059669;
                  border-right: 2.5px solid #059669;
                  transform: rotate(45deg) translate(-20%, -30%);
                  animation: checkmark 0.4s ease-out forwards;
                }
              `}</style>
              <span className="checkmark-line" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Item created successfully</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Invite sent to {fields.customerEmail}</p>
            </div>
            <div className="w-full">
              <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2">
                <code className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">
                  https://beemhive.com/t/{createdSlug}
                </code>
                <button
                  onClick={copyUrl}
                  className="shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {urlCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2.5 text-left">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Program the NFC card</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Open NFC Tools on your phone → tap <strong>Write</strong> → <strong>URL</strong> → paste the link above → tap your NFC card
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create NFC Item</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Customer name */}
              <div>
                <label className={labelClass}>Customer name</label>
                <input
                  type="text"
                  value={fields.customerName}
                  onChange={e => setField('customerName', e.target.value)}
                  onBlur={() => touch('customerName')}
                  placeholder="e.g. Kofi Mensah"
                  disabled={submitting}
                  className={inputClass}
                />
                {errors.customerName && <p className={errorClass}>{errors.customerName}</p>}
              </div>

              {/* Customer email */}
              <div>
                <label className={labelClass}>Customer email</label>
                <input
                  type="email"
                  value={fields.customerEmail}
                  onChange={e => setField('customerEmail', e.target.value)}
                  onBlur={() => touch('customerEmail')}
                  placeholder="kofi@example.com"
                  disabled={submitting}
                  className={inputClass}
                />
                {errors.customerEmail && <p className={errorClass}>{errors.customerEmail}</p>}
              </div>

              {/* Confirm customer email */}
              <div>
                <label className={labelClass}>Confirm customer email</label>
                <input
                  type="email"
                  value={fields.confirmEmail}
                  onChange={e => { setField('confirmEmail', e.target.value); touch('confirmEmail') }}
                  onBlur={() => touch('confirmEmail')}
                  placeholder="Re-enter email address"
                  disabled={submitting}
                  className={inputClass}
                />
                {confirmMismatch && (
                  <p className={errorClass}>Email addresses don't match</p>
                )}
              </div>

              {/* Product type */}
              <div>
                <label className={labelClass}>Product type</label>
                <Select
                  value={fields.productType}
                  onValueChange={v => { setField('productType', v); touch('productType') }}
                  disabled={submitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a type…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="stand">Stand</SelectItem>
                    <SelectItem value="round_tag">Round Tag</SelectItem>
                  </SelectContent>
                </Select>
                {errors.productType && <p className={errorClass}>{errors.productType}</p>}
              </div>

              {/* Slug */}
              <div>
                <label className={labelClass}>Profile URL slug</label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent">
                    <span className="pl-3 text-sm text-gray-400 dark:text-gray-500 shrink-0 select-none">beemhive.com/t/</span>
                    <input
                      type="text"
                      value={fields.slug}
                      onChange={handleSlugChange}
                      onBlur={() => touch('slug')}
                      placeholder="my-slug"
                      disabled={submitting}
                      className="flex-1 py-2 pr-3 text-sm text-gray-900 dark:text-gray-100 bg-transparent focus:outline-none disabled:opacity-50 min-w-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateSlug}
                    disabled={submitting}
                    title="Generate random slug"
                    className="shrink-0 p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <Shuffle size={15} />
                  </button>
                </div>
                {fields.slug && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    https://beemhive.com/t/{fields.slug}
                  </p>
                )}
                {(errors.slug || slugFieldError) && (
                  <p className={errorClass}>{slugFieldError || errors.slug}</p>
                )}
              </div>

              {/* Error banner */}
              {errorBanner && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-2">
                  <p className="text-sm text-rose-600 dark:text-rose-400">{errorBanner}</p>
                </div>
              )}

              {/* Submit */}
              <div
                onClick={submitting ? undefined : handleSubmit}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer select-none
                  ${submitting
                    ? 'bg-emerald-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                  }`}
              >
                {submitting && (
                  <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {submitting ? 'Creating…' : 'Create NFC Item'}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
