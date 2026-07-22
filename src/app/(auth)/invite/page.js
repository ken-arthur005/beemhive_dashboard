'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, UserCheck, Link2Off as LinkOff, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PasswordStrength from '@/components/shared/password-strength'

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400'

function StatusCard({ icon, iconBg, heading, body }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className={`flex items-center justify-center w-16 h-16 rounded-full ${iconBg}`}>
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

export default function InvitePage() {
  const router = useRouter()

  // token state: 'checking' | 'ready' | 'invalid' | 'expired'
  const [tokenState, setTokenState] = useState('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inlineError, setInlineError] = useState(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setTokenState(session ? 'ready' : 'invalid')
    })
  }, [])

  const passwordError = passwordTouched && password.length < 8 ? 'Password must be at least 8 characters.' : null
  const confirmError = confirmTouched && confirm !== password ? "Passwords don't match" : null

  async function handleSubmit() {
    setPasswordTouched(true)
    setConfirmTouched(true)
    if (password.length < 8 || password !== confirm) return

    setSubmitting(true)
    setInlineError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setInlineError('Something went wrong setting your password. Please try again.')
      setSubmitting(false)
      return
    }

    router.push('/customer/profile')
  }

  const formPanel = (
    <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
      {tokenState === 'checking' && (
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      )}

      {tokenState === 'invalid' && (
        <StatusCard
          iconBg="bg-rose-100"
          icon={<LinkOff size={32} className="text-rose-500" />}
          heading="Invalid invite link"
          body="This invite link is not valid. Please contact Beem Hive to receive a new one."
        />
      )}

      {tokenState === 'expired' && (
        <StatusCard
          iconBg="bg-amber-100"
          icon={<Clock size={32} className="text-amber-500" />}
          heading="This link has expired"
          body="Invite links expire after 48 hours. Please contact Beem Hive to receive a new invite."
        />
      )}

      {tokenState === 'ready' && (
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="flex justify-center mb-8 md:hidden">
            {/* TODO: replace with logo asset */}
            <Image src="/logo.png" alt="Beem Hive" width={120} height={120} priority />
          </div>

          {/* Welcome icon */}
          <div className="flex justify-center mb-5">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100">
              <UserCheck size={32} className="text-amber-600" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 text-center">You've been invited</h1>
          <p className="mt-1 text-sm text-gray-500 text-center">Set a password to activate your Beem Hive account</p>

          <div className="mt-8 space-y-5">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Choose a password</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
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

            {/* Inline error */}
            {inlineError && (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{inlineError}</p>
            )}

            {/* Submit */}
            <div
              role="button"
              tabIndex={0}
              onClick={submitting ? undefined : handleSubmit}
              onKeyDown={e => { if (!submitting && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleSubmit() } }}
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
              {submitting ? 'Activating…' : 'Activate my account'}
            </div>
          </div>
        </div>
      )}
    </div>
  )

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

      {formPanel}
    </div>
  )
}
