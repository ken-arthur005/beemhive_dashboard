'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function mapAuthError(error) {
  if (!error) return null
  const msg = error.message?.toLowerCase() ?? ''
  if (msg.includes('invalid login credentials') || error.code === 'invalid_credentials') {
    return 'Incorrect email or password.'
  }
  if (msg.includes('email not confirmed') || error.code === 'email_not_confirmed') {
    return 'Please confirm your email before signing in.'
  }
  return 'Something went wrong. Please try again.'
}

async function getRoleAndRedirect(supabase, userId, router) {
  const { data: roleData } = await supabase
    .from('users_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (!roleData?.role) {
    await supabase.auth.signOut()
    return null
  }

  if (roleData.role === 'admin') {
    router.push('/admin/nfc-items')
  } else {
    router.push('/customer/profile')
  }

  return roleData.role
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const role = await getRoleAndRedirect(supabase, session.user.id, router)
        if (!role) setCheckingSession(false)
      } else {
        setCheckingSession(false)
      }
    })
  }, [])

  async function handleSignIn() {
    if (loading) return
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(mapAuthError(authError))
      setLoading(false)
      return
    }

    const role = await getRoleAndRedirect(supabase, data.user.id, router)
    if (!role) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  function handlePasswordKeyDown(e) {
    if (e.key === 'Enter') handleSignIn()
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-amber-400 to-yellow-500 flex-col items-center justify-center p-12">
        <Image
          src="/logo.png"
          alt="Beem Hive"
          width={180}
          height={180}
          className="drop-shadow-md"
          priority
        />
        <p className="mt-6 text-amber-900 text-lg font-medium text-center leading-snug">
          NFC-powered digital profiles.<br />
          Tap to connect, instantly.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="flex justify-center mb-8 md:hidden">
            <Image
              src="/logo.png"
              alt="Beem Hive"
              width={120}
              height={120}
              priority
            />
          </div>

          <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>

          <div className="mt-8 space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyDown}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                />
                <div
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </div>
              </div>
              <div className="mt-1.5 text-right">
                <a
                  href="/forgot-password"
                  className="text-xs text-amber-600 hover:text-amber-700 hover:underline"
                >
                  Forgot password?
                </a>
              </div>
            </div>

            {/* Inline error */}
            {error && (
              <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <div
              onClick={handleSignIn}
              className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer select-none
                ${loading
                  ? 'bg-amber-300 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
                }`}
            >
              {loading && (
                <svg
                  className="w-4 h-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              )}
              {loading ? 'Signing in…' : 'Sign in'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
