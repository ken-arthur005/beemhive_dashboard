'use client'

import { useEffect, useRef, useState } from 'react'
import { getAuthSession } from '@/lib/supabase/client'
import { safeNext } from '@/lib/supabase/redirects'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

const warningMs = 2 * 60_000

export default function SessionGuard({ initialSession, userId, role }) {
  const [warning, setWarning] = useState(false)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const actions = useRef({})

  useEffect(() => {
    if (!initialSession?.idleExpiresAt) return
    let session = initialSession
    let offset = Date.parse(session.serverNow) - Date.now()
    let dirty = false
    let lastTouch = 0
    let lastCheck = Date.now()
    let inFlight = false
    let disposed = false
    let isLocked = false
    const controller = new AbortController()
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('beem-session') : null

    function lock() { isLocked = true; setLocked(true); setWarning(false) }
    function sameAccount(data) {
      if (data.user?.id !== userId || data.role !== role) { lock(); setError('Sign back in with the same account to keep working on this page.'); return false }
      if (data.mfaRequired && !window.location.pathname.startsWith('/mfa')) { lock(); setError('Complete your authenticator check in the sign-in tab, then resume here.'); return false }
      return true
    }
    function accept(next) {
      session = next
      offset = Date.parse(next.serverNow) - Date.now()
      isLocked = false
      setLocked(false)
      setError('')
      setWarning(Date.parse(next.idleExpiresAt) - (Date.now() + offset) <= warningMs)
    }
    async function check(touch = false, resume = false) {
      if (inFlight || disposed) return
      inFlight = true
      setBusy(true)
      lastCheck = Date.now()
      try {
        // A touch never revives an expired session; the server checks expiry before updating activity.
        if (touch) {
          const response = await fetch('/api/auth/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
          const data = await response.json()
          if (!response.ok) { const failure = new Error(data.error); failure.status = response.status; throw failure }
          if (!sameAccount(data)) return
          if (!disposed) accept(data.session)
          lastTouch = Date.now()
          dirty = false
          channel?.postMessage('activity')
        } else {
          const data = await getAuthSession({ signal: controller.signal })
          if (!sameAccount(data)) return
          if (!disposed) accept(data.session)
          if (resume) channel?.postMessage('activity')
        }
      } catch (failure) {
        if (disposed) return
        if ([401, 403].includes(failure.status) || Date.now() + offset >= Date.parse(session.idleExpiresAt)) lock()
        setError('Unable to verify your session. Sign in again if needed, then retry.')
      } finally { inFlight = false; if (!disposed) setBusy(false) }
    }
    actions.current = { stay: () => check(true), resume: () => check(false, true) }
    function activity(event) {
      if (!event.isTrusted || document.visibilityState !== 'visible' || isLocked) return
      dirty = true
      if (Date.now() - lastTouch >= 60_000) void check(true)
    }
    function visible() { if (document.visibilityState === 'visible') void check() }
    function denied(event) {
      if (event.detail === 'mfa_required' || event.detail === 'session_expired' || event.detail === 'unauthenticated') lock()
    }
    const timer = setInterval(() => {
      if (isLocked) return
      const remaining = Date.parse(session.idleExpiresAt) - (Date.now() + offset)
      setWarning(remaining <= warningMs)
      if (remaining <= 0 || Date.now() - lastCheck >= 60_000) void check()
      else if (dirty && Date.now() - lastTouch >= 60_000 && document.visibilityState === 'visible') void check(true)
    }, 1000)
    // Wheel/pointer/key input is user intent; a programmatic scroll must not keep a session alive.
    for (const event of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(event, activity, { passive: true })
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('beem:auth-required', denied)
    if (channel) channel.onmessage = () => { void check() }
    return () => {
      disposed = true
      controller.abort()
      clearInterval(timer)
      channel?.close()
      for (const event of ['pointerdown', 'keydown', 'wheel']) window.removeEventListener(event, activity)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('beem:auth-required', denied)
    }
  }, [initialSession, userId, role])

  const next = typeof window === 'undefined' ? '/customer/profile' : safeNext(`${window.location.pathname}${window.location.search}`)
  // Force the password form even while the old session is still within its final warning window.
  const loginUrl = `/login?error=session_expired&next=${encodeURIComponent(next)}`
  return <>
    {warning && !locked && <aside role="status" aria-label="Session expiry warning" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-border bg-background p-4 shadow-xl">
      <p className="font-medium">Your session will end soon</p>
      <p className="mt-2 text-sm text-muted-foreground">Stay signed in to extend inactivity. The fixed maximum session lifetime cannot be extended.</p>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3"><Button disabled={busy} onClick={() => actions.current.stay?.()}>{busy ? 'Checking…' : 'Stay signed in'}</Button><a className="text-sm underline" href={loginUrl} target="_blank" rel="noopener noreferrer">Sign in again</a></div>
    </aside>}
    {locked && <div className="fixed inset-0 z-50 bg-background" aria-hidden="true" />}
    <AlertDialog open={locked}>
      <AlertDialogContent>
        <AlertDialogTitle>Sign in again to continue</AlertDialogTitle>
        <AlertDialogDescription>Your workspace is locked. Sign in in a new tab, then resume here. This keeps any unsaved edits on this page in memory; closing or refreshing it will discard them.</AlertDialogDescription>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <AlertDialogFooter>
          <a className="hive-action hive-action-primary" href={loginUrl} target="_blank" rel="noopener noreferrer">Sign in in a new tab</a>
          <Button disabled={busy} onClick={() => actions.current.resume?.()}>I’ve signed in — resume</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
