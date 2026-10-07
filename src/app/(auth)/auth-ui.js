'use client'

import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'

export const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50'
export const buttonClass = 'w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50'

export function AuthShell({ children }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-amber-400 to-yellow-500 flex-col items-center justify-center p-12">
        <Image src="/logo.png" alt="Beem Hive" width={180} height={180} priority />
        <p className="mt-6 text-amber-900 text-lg font-medium text-center">NFC-powered digital profiles.<br />Tap to connect, instantly.</p>
      </div>
      <main className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8 md:hidden"><Image src="/logo.png" alt="Beem Hive" width={120} height={120} priority /></div>
          {children}
        </div>
      </main>
    </div>
  )
}

export function PasswordInput({ id, label, value, onChange, visible, onToggle, disabled, autoComplete = 'new-password', describedBy }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input id={id} name={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange}
          required minLength={autoComplete === 'new-password' ? 8 : undefined} maxLength={128}
          autoComplete={autoComplete} disabled={disabled} aria-describedby={describedBy} className={`${inputClass} pr-12`} />
        <button type="button" onClick={onToggle} disabled={disabled} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible} className="absolute inset-y-0 right-0 px-3 text-gray-500 focus-visible:outline-2 focus-visible:outline-amber-600">
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}

export function authMessage(code) {
  const messages = {
    account_inactive: 'Your account is unavailable or suspended. Contact Beem Hive for help.',
    role_missing: 'Your account has no assigned role yet. Contact Beem Hive to finish provisioning.',
    invalid_role: 'Your account does not have a supported role. Contact Beem Hive.',
    account_pending: 'Your account is still being provisioned. Please try again later or contact Beem Hive.',
    wrong_role: 'This account cannot access this area.',
    account_unavailable: 'Unable to check your account. Please try again.',
    auth_unavailable: 'Sign-in is temporarily unavailable. Please try again.',
    invalid_callback: 'This sign-in link could not be verified. Sign in again.',
    grant_expired: 'Your setup link has expired or has already been used. Please request a new one.',
    invalid_grant: 'This setup link is not valid. Please request a new one.',
    grant_issue_failed: 'Your email was verified, but setup could not start. Please request a new link.',
  }
  return messages[code] || 'Please open a fresh invitation or password reset email to continue.'
}
