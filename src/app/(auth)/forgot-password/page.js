'use client'

import { useState } from 'react'
import Image from 'next/image'
import { KeyRound, MailCheck, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [inlineError, setInlineError] = useState(null)

  const emailError = emailTouched && !isValidEmail(email) ? 'Please enter a valid email address.' : null

  async function handleSubmit() {
    if (loading) return
    setEmailTouched(true)
    if (!isValidEmail(email)) return

    setLoading(true)
    setInlineError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://beemhive.com/reset-password',
    })

    if (error) {
      setInlineError('Something went wrong. Please try again in a moment.')
      setLoading(false)
      return
    }

    setSubmitted(true)
  }

  const formPanel = (
    <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Mobile-only logo */}
        <div className="flex justify-center mb-8 md:hidden">
          {/* TODO: replace with logo asset */}
          <Image src="/logo.png" alt="Beem Hive" width={120} height={120} priority />
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100">
              <MailCheck size={24} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Check your email</h1>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                If an account exists for <strong className="text-gray-700">{email}</strong>, you'll receive a password reset link shortly. Check your spam folder if it doesn't arrive within a few minutes.
              </p>
            </div>
            <a
              href="/login"
              className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 hover:underline"
            >
              <ArrowLeft size={14} />
              Back to login
            </a>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-5">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100">
                <KeyRound size={24} className="text-amber-600" />
              </div>
            </div>

            <h1 className="text-2xl font-semibold text-gray-900 text-center">Forgot your password?</h1>
            <p className="mt-1 text-sm text-gray-500 text-center">Enter your email and we'll send you a reset link</p>

            <div className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setInlineError(null) }}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="you@example.com"
                  disabled={loading}
                  className={inputClass}
                />
                {emailError && <p className="mt-1 text-xs text-rose-600">{emailError}</p>}
              </div>

              {inlineError && (
                <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{inlineError}</p>
              )}

              <div
                onClick={handleSubmit}
                className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors cursor-pointer select-none
                  ${loading
                    ? 'bg-amber-300 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
                  }`}
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {loading ? 'Sending…' : 'Send reset link'}
              </div>

              <div className="flex justify-center">
                <a
                  href="/login"
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 hover:underline"
                >
                  <ArrowLeft size={14} />
                  Back to login
                </a>
              </div>
            </div>
          </>
        )}
      </div>
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
