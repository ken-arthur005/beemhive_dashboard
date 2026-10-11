'use client'

import { Eye, EyeOff, ArrowUpRight } from 'lucide-react'
import Brand from '@/components/shared/brand'
import BeeScene from '@/components/shared/bee-scene'

export const inputClass = 'hive-input'
export const buttonClass = 'hive-action hive-action-primary w-full min-h-12'

export function AuthShell({ children }) {
  return (
    <div className="hive-auth-shell">
      <section className="hive-auth-story" aria-label="Welcome to Beem Hive">
        <Brand />
        <div className="hive-auth-story-content"><p className="hive-eyebrow">Made for your next connection</p><h2>Every introduction.<br />A new possibility.</h2><BeeScene /><p className="hive-auth-tagline">Your world, one tap away.</p></div>
        <div className="hive-auth-story-footer"><span>NFC-powered digital profiles</span><ArrowUpRight size={18} /></div>
      </section>
      <main id="main-content" className="hive-auth-main">
        <div className="hive-auth-mobile-brand"><Brand /></div>
        <div className="hive-auth-mobile-scene"><BeeScene compact /></div>
        <div className="hive-auth-form"><p className="hive-eyebrow mb-5">Welcome to the hive</p>{children}</div>
        <footer className="hive-auth-footer">Good connections start with you. <span>Beem Hive © {new Date().getFullYear()}</span></footer>
      </main>
    </div>
  )
}

export function PasswordInput({ id, label, value, onChange, visible, onToggle, disabled, autoComplete = 'new-password', describedBy }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-2">{label}</label>
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
