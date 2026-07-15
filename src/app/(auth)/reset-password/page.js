'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Clock, Link2Off as LinkOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PasswordStrength from '@/components/shared/password-strength'

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400'

function StatusCard({ iconBg, icon, heading, body, action }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className={`flex items-center justify-center w-12 h-12 rounded-full ${iconBg}`}>
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">{body}</p>
      </div>
      {action}
    </div>
  )
}

function OutlineButton({ href, children }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      {children}
    </a>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const [view, setView] = useState(
    !tokenHash || type !== 'recovery' ? 'invalid' : 'form'
  )

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inlineError, setInlineError] = useState(null)

  useEffect(() => {
    if (view === 'success') {
      const timer = setTimeout(() => router.push('/login'), 2500)
      return () => clearTimeout(timer)
    }
  }, [view, router])

  const passwordError = passwordTouched && password.length < 8
    ? 'Password must be at least 8 characters.'
    : null
  const confirmError = confirmTouched && confirm !== password
    ? "Passwords don't match."
    : null

  async function handleSubmit() {
    if (submitting) return
    setPasswordTouched(true)
    setConfirmTouched(true)
    if (password.length < 8 || password !== confirm) return

    setSubmitting(true)
    setInlineError(null)

    const supabase = createClient()

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })

    if (verifyError) {
      const msg = verifyError.message?.toLowerCase() ?? ''
      if (msg.includes('expired') || msg.includes('invalid')) {
        setView('expired')
      } else {
        setInlineError('Something went wrong. Please try again or request a new reset link.')
        setSubmitting(false)
      }
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setInlineError('Something went wrong. Please try again or request a new reset link.')
      setSubmitting(false)
      return
    }

    setView('success')
  }

  if (view === 'invalid') {
    return (
      <StatusCard
        iconBg="bg-rose-100"
        icon={<LinkOff size={24} className="text-rose-500" />}
        heading="Invalid reset link"
        body="This link isn't valid. Please request a new password reset."
        action={<OutlineButton href="/forgot-password">Request new link</OutlineButton>}
      />
    )
  }

  if (view === 'expired') {
    return (
      <StatusCard
        iconBg="bg-amber-100"
        icon={<Clock size={24} className="text-amber-500" />}
        heading="Reset link expired"
        body="Password reset links expire after 1 hour. Please request a new one."
        action={<OutlineButton href="/forgot-password">Request new link</OutlineButton>}
      />
    )
  }

  if (view === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100">
          <ShieldCheck size={24} className="text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Password updated</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Your password has been changed successfully. Redirecting you to login…
          </p>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full"
            style={{
              animation: 'progress-fill 2.5s linear forwards',
            }}
          />
        </div>
        <style>{`
          @keyframes progress-fill {
            from { width: 0% }
            to { width: 100% }
          }
        `}</style>
        <a
          href="/login"
          className="text-sm text-amber-600 hover:text-amber-700 hover:underline"
        >
          Go to login now
        </a>
      </div>
    )
  }

  // form view
  return (
    <>
      {/* Mobile-only logo */}
      <div className="flex justify-center mb-8 md:hidden">
        {/* TODO: replace with logo asset */}
        <Image src="/logo.png" alt="Beem Hive" width={120} height={120} priority />
      </div>

      <div className="flex justify-center mb-5">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100">
          <LockKeyhole size={24} className="text-amber-600" />
        </div>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 text-center">Set a new password</h1>
      <p className="mt-1 text-sm text-gray-500 text-center">Choose a strong password for your account</p>

      <div className="mt-8 space-y-5">
        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setInlineError(null) }}
              onBlur={() => setPasswordTouched(true)}
              placeholder="••••••••"
              maxLength={128}
              disabled={submitting}
              className={`${inputClass} pr-10`}
            />
            <div
              onClick={() => setShowPassword(v => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </div>
          </div>
          {passwordError && <p role="alert" className="mt-1 text-xs text-rose-600">{passwordError}</p>}
          <PasswordStrength password={password} />
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setConfirmTouched(true) }}
              onBlur={() => setConfirmTouched(true)}
              placeholder="••••••••"
              maxLength={128}
              disabled={submitting}
              className={`${inputClass} pr-10`}
            />
            <div
              onClick={() => setShowConfirm(v => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </div>
          </div>
          {confirmError && <p role="alert" className="mt-1 text-xs text-rose-600">{confirmError}</p>}
        </div>

        {inlineError && (
          <div>
            <p role="alert" className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{inlineError}</p>
            <div className="mt-2 text-center">
              <a href="/forgot-password" className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
                Request new link
              </a>
            </div>
          </div>
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={handleSubmit}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSubmit() } }}
          aria-disabled={submitting}
          className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors cursor-pointer select-none
            ${submitting
              ? 'bg-amber-300 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
            }`}
        >
          {submitting && (
            <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {submitting ? 'Updating…' : 'Update password'}
        </div>
      </div>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-amber-400 to-yellow-500 flex-col items-center justify-center p-12">
        {/* TODO: replace with logo asset */}
        <Image src="/logo.png" alt="Beem Hive" width={180} height={180} className="drop-shadow-md" priority />
        <p className="mt-6 text-amber-900 text-lg font-medium text-center leading-snug">
          NFC-powered digital profiles.<br />
          Tap to connect, instantly.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <Suspense fallback={
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
