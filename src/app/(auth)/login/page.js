'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient, getAuthSession } from '@/lib/supabase/client'
import { roleDestination } from '@/lib/supabase/redirects'
import { AuthShell, PasswordInput, inputClass, buttonClass, authMessage } from '../auth-ui'

function loginError(error) {
  if (error.code === 'invalid_credentials') return 'Incorrect email or password.'
  if (error.code === 'email_not_confirmed') return 'Please confirm your email before signing in.'
  if (error.status === 429) return 'Too many sign-in attempts. Please wait before trying again.'
  return error.status ? error.message : 'Unable to connect. Please try again.'
}

async function enterAccount(signal) {
  const session = await getAuthSession({ signal })
  if (session.pending || !['admin', 'customer'].includes(session.role)) {
    const failure = new Error(authMessage(session.role ? 'account_pending' : 'role_missing'))
    failure.status = 409
    throw failure
  }
  const next = new URLSearchParams(window.location.search).get('next')
  window.location.assign(roleDestination(session.role, next))
}

function LoginForm() {
  const params = useSearchParams()
  const code = params.get('error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [checking, setChecking] = useState(!code)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(code ? authMessage(code) : '')

  useEffect(() => {
    const controller = new AbortController()
    // A denied account is a terminal login state, never an automatic bounce.
    if (code) {
      return () => controller.abort()
    }
    enterAccount(controller.signal).catch(failure => {
      if (controller.signal.aborted) return
      if (failure.status !== 401) setError(loginError(failure))
      setChecking(false)
    })
    return () => controller.abort()
  }, [code])

  async function submit(event) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const { error: failure } = await createClient().auth.signInWithPassword({ email: email.trim(), password })
      if (failure) throw failure
      await enterAccount()
    } catch (failure) {
      setError(loginError(failure))
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
      <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
      {checking ? <p role="status" className="mt-8 text-sm text-gray-600">Checking your account…</p> : (
        <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={loading}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="email" name="email" type="email" required maxLength={254} autoComplete="username" value={email}
              onChange={event => setEmail(event.target.value)} disabled={loading} className={inputClass} />
          </div>
          <PasswordInput id="password" label="Password" value={password} onChange={event => setPassword(event.target.value)}
            visible={visible} onToggle={() => setVisible(!visible)} disabled={loading} autoComplete="current-password" />
          <div className="text-right"><a href="/forgot-password" className="text-sm text-amber-700 hover:underline">Forgot password?</a></div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      )}
    </AuthShell>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<AuthShell><p role="status">Loading sign in…</p></AuthShell>}><LoginForm /></Suspense>
}
