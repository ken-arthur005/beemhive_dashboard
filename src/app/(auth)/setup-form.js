'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PasswordStrength from '@/components/shared/password-strength'
import { AuthShell, PasswordInput, buttonClass, authMessage } from './auth-ui'

async function loadGrant(purpose, signal) {
  try {
    const response = await fetch(`/api/auth/setup?purpose=${purpose}`, { cache: 'no-store', credentials: 'same-origin', signal })
    const data = await response.json()
    if (!response.ok) return {
      error: data.error || 'Unable to check your setup link.',
      state: [401, 403, 410].includes(response.status) ? 'invalid' : 'retry', passwordUpdated: false,
    }
    return { error: '', state: data.state === 'completed' ? 'success' : data.state, passwordUpdated: data.passwordUpdated, next: data.next }
  } catch (failure) {
    if (signal?.aborted) throw failure
    return { error: 'Unable to connect. Check your connection and try again.', state: 'retry', passwordUpdated: false }
  }
}

function SetupFormContent({ purpose }) {
  const params = useSearchParams()
  const linkError = params.get('error')
  const tokenHash = params.get('token_hash')
  const [state, setState] = useState(linkError ? 'invalid' : 'checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(linkError ? authMessage(linkError) : '')
  const [passwordUpdated, setPasswordUpdated] = useState(false)
  const [destination, setDestination] = useState('/login')
  const safeDestination = value => ['/admin/nfc-items', '/customer/profile', '/customer/overview'].includes(value) ? value : '/login'

  async function check() {
    setState('checking')
    const result = await loadGrant(purpose)
    setError(result.error)
    setState(result.state)
    setPasswordUpdated(result.passwordUpdated)
    setDestination(safeDestination(result.next))
  }

  useEffect(() => {
    const controller = new AbortController()
    if (linkError) {
      return () => controller.abort()
    } else if (tokenHash !== null) {
      // Legacy direct token links are verified only by the server handler.
      const query = new URLSearchParams({ token_hash: tokenHash, type: purpose })
      window.location.replace(`/auth/confirm?${query}`)
    } else {
      loadGrant(purpose, controller.signal).then(result => {
        if (controller.signal.aborted) return
        setError(result.error)
        setState(result.state)
        setPasswordUpdated(result.passwordUpdated)
        setDestination(safeDestination(result.next))
      }).catch(() => { /* Aborted during navigation. */ })
    }
    return () => controller.abort()
  }, [purpose, linkError, tokenHash])

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Setup did not finish. Please retry with the same password.')
        if (['grant_missing', 'invalid_grant', 'grant_expired', 'account_inactive', 'unauthenticated'].includes(data.code)) setState('invalid')
        return
      }
      setPassword('')
      setConfirm('')
      setState('success')
      setDestination(safeDestination(data.next))
    } catch {
      setError('The result could not be confirmed. Retry on this page with the same password.')
    } finally { setBusy(false) }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold text-gray-900">{purpose === 'invite' ? 'Activate your account' : 'Set a new password'}</h1>
      {state === 'checking' && <p role="status" className="mt-4 text-sm text-gray-600">Checking your setup link…</p>}
      {state === 'success' ? (
        <div className="mt-6 space-y-4">
          <p role="status" className="text-sm text-gray-700">Your password has been updated successfully.</p>
          <a href={destination} className="text-sm text-amber-700 underline">Continue to your dashboard</a>
        </div>
      ) : state === 'ready' ? (
        <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={busy}>
          <p id="password-help" className="text-sm text-gray-600">Use 8–128 characters. {passwordUpdated ? 'Your password was saved; retry to finish account setup.' : 'Choose a password you do not use elsewhere.'}</p>
          <PasswordInput id="new-password" label="New password" value={password} onChange={event => setPassword(event.target.value)}
            visible={visible} onToggle={() => setVisible(!visible)} disabled={busy} describedBy="password-help" />
          <PasswordStrength password={password} />
          <PasswordInput id="confirm-password" label="Confirm password" value={confirm} onChange={event => setConfirm(event.target.value)}
            visible={confirmVisible} onToggle={() => setConfirmVisible(!confirmVisible)} disabled={busy} />
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={busy} className={buttonClass}>{busy ? 'Saving…' : purpose === 'invite' ? 'Activate my account' : 'Update password'}</button>
        </form>
      ) : state !== 'checking' && (
        <div className="mt-6 space-y-4">
          <p role="alert" className="text-sm text-gray-700">{state === 'pending' ? 'Your account is still being provisioned. Try again shortly or contact Beem Hive.' : error}</p>
          {['pending', 'retry'].includes(state) && <button type="button" className={buttonClass} onClick={() => check()}>Check again</button>}
          {state === 'invalid' && <p className="text-sm text-gray-600">{purpose === 'invite' ? 'Ask Beem Hive to send a new invitation, or request a password reset if your account already exists.' : 'Request a new password reset email to continue.'}</p>}
          <a href="/forgot-password" className="block text-sm text-amber-700 underline">Request a new reset link</a>
          <a href="/login" className="block text-sm text-gray-600 underline">Back to sign in</a>
        </div>
      )}
    </AuthShell>
  )
}

export default function SetupForm({ purpose }) {
  return <Suspense fallback={<AuthShell><p role="status">Checking your setup link…</p></AuthShell>}><SetupFormContent purpose={purpose} /></Suspense>
}
