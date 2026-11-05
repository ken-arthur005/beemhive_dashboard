'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, getAuthSession } from '@/lib/supabase/client'
import { roleDestination } from '@/lib/supabase/redirects'
import { enrollAuthenticator, totpFactors, verifyAuthenticator } from '@/lib/mfa'
import SessionGuard from '@/components/shared/session-guard'
import { AuthShell, inputClass, buttonClass } from '../auth-ui'

function MfaForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')
  const [account, setAccount] = useState(null)
  const [factors, setFactors] = useState([])
  const [factorId, setFactorId] = useState('')
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const session = await getAuthSession({ signal: controller.signal })
        if (controller.signal.aborted) return
        if (!session.mfaRequired) {
          window.location.assign(roleDestination(session.role, next, { hasPublished: session.hasPublished }))
          return
        }
        const verified = await totpFactors(createClient())
        if (controller.signal.aborted) return
        setAccount(session)
        setFactors(verified)
        setFactorId(verified[0]?.id || '')
      } catch (failure) {
        if (controller.signal.aborted) return
        if (failure.status === 401) { router.replace('/login'); return }
        setError('Unable to load authenticator security. Please retry or contact Beem Hive.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    load()
    return () => controller.abort()
  }, [next, attempt, router])

  async function enroll() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await enrollAuthenticator(createClient())
      setEnrollment(result)
      setFactorId(result.id)
    } catch { setError('Authenticator setup could not start. Retry, or sign in with an existing authenticator if one is already enabled.') }
    finally { setBusy(false) }
  }

  async function verify(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await verifyAuthenticator(createClient(), factorId, code)
      // Do not treat a browser callback as authorization; confirm server-side AAL and session validity.
      const session = await getAuthSession()
      if (session.mfaRequired) throw new Error('Verification has not completed.')
      setEnrollment(null)
      window.location.assign(roleDestination(session.role, next, { hasPublished: session.hasPublished }))
    } catch {
      setCode('')
      setError('Verification failed. Enter a fresh code, check your phone’s time setting, and try again.')
      setBusy(false)
    }
  }

  return <AuthShell>
    {account && <SessionGuard initialSession={account.session} userId={account.user.id} role={account.role} />}
    <h1>{factors.length ? 'One more security check.' : 'Protect your admin account.'}</h1>
    {loading ? <p role="status" className="mt-6 text-sm">Checking authenticator security…</p> : <>
      {account && <p className="mt-3 text-sm text-muted-foreground">{factors.length
        ? 'Enter the code from your authenticator app to open your admin workspace.'
        : 'Admin accounts require an authenticator app. Google Authenticator, Microsoft Authenticator, and compatible apps work.'}</p>}
      {account && !factorId && <button type="button" onClick={enroll} disabled={busy} className={`${buttonClass} mt-6`}>{busy ? 'Preparing…' : 'Set up authenticator'}</button>}
      {enrollment && <div className="mt-5 space-y-4">
        {/* Native Supabase SVG data URL, never third-party QR generation or raw HTML. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.totp.qr_code} alt="Scan this QR code in your authenticator app" width={220} height={220} className="mx-auto rounded-xl bg-white p-3" />
        <details className="text-sm"><summary className="cursor-pointer">Can’t scan? Use the setup key</summary><code className="mt-2 block break-all rounded-lg bg-muted p-3 select-all">{enrollment.totp.secret}</code></details>
        <p className="text-sm text-muted-foreground">Before verifying, save the setup key in a secure password manager or add it to a backup authenticator. Never share it. A password reset does not remove MFA.</p>
      </div>}
      {factorId && <form onSubmit={verify} className="mt-6 space-y-4" aria-busy={busy}>
        {factors.length > 1 && <div><label htmlFor="authenticator" className="mb-2 block text-sm font-medium">Authenticator</label><select id="authenticator" className={inputClass} value={factorId} onChange={event => setFactorId(event.target.value)} disabled={busy}>{factors.map(factor => <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Authenticator'}</option>)}</select></div>}
        <div><label htmlFor="authenticator-code" className="mb-2 block text-sm font-medium">Authenticator code</label><input id="authenticator-code" className={inputClass} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} aria-describedby="mfa-help" /></div>
        <button type="submit" disabled={busy || code.length !== 6} className={buttonClass}>{busy ? 'Verifying…' : enrollment ? 'Enable MFA and continue' : 'Verify and continue'}</button>
      </form>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      {!account && <button className={`${buttonClass} mt-5`} onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>Retry security check</button>}
      <p id="mfa-help" className="mt-6 text-xs text-muted-foreground">Lost access to your authenticator? Contact the business owner for verified account recovery. <a className="underline" href="mailto:beemhive305@gmail.com">Contact Beem Hive</a>.</p>
      <button className="mt-4 text-sm underline" disabled={busy} onClick={async () => { await createClient().auth.signOut({ scope: 'local' }); router.replace('/login') }}>Use a different account</button>
    </>}
  </AuthShell>
}

export default function MfaPage() {
  return <Suspense fallback={<AuthShell><p role="status">Loading security check…</p></AuthShell>}><MfaForm /></Suspense>
}
