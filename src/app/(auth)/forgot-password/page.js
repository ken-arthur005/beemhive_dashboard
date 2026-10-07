'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { appOrigin } from '@/lib/platform'
import { AuthShell, inputClass, buttonClass } from '../auth-ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${appOrigin()}/auth/confirm?type=recovery`,
      })
      if (result.error) {
        setError(result.error.status === 429 ? 'Too many requests. Please wait before requesting another link.' : 'The reset email could not be sent. Please try again.')
      } else setSubmitted(true)
    } catch { setError('Unable to connect. Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold text-gray-900">{submitted ? 'Check your email' : 'Forgot your password?'}</h1>
      {submitted ? <p role="status" className="mt-4 text-sm text-gray-600">If an account exists for {email}, you will receive a reset link shortly. Check your spam folder too.</p> : (
        <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={busy}>
          <p className="text-sm text-gray-600">Enter your email and we will send you a reset link.</p>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input id="email" name="email" type="email" required autoComplete="email" maxLength={254} value={email}
              onChange={event => setEmail(event.target.value)} disabled={busy} className={inputClass} />
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={busy} className={buttonClass}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <a href="/login" className="mt-6 inline-block text-sm text-amber-700 underline">Back to sign in</a>
    </AuthShell>
  )
}
