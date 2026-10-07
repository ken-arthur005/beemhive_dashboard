import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAccount } from '@/lib/auth'
import { issueSetupGrant, clearSetupCookie } from '@/lib/supabase/setup-grants'
import { assertSameOrigin } from '@/lib/http'

export async function GET(request) {
  const params = new URL(request.url).searchParams
  const purpose = params.get('type')
  const token = params.get('token_hash')
  if (!['invite', 'recovery'].includes(purpose) || !token || token.length > 512 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return clearSetupCookie(NextResponse.redirect(new URL('/reset-password?error=invalid_grant', request.url)))
  }
  // Email security scanners follow GET/HEAD links. Verification is deliberately
  // deferred to an explicit same-origin POST so they cannot consume the OTP.
  const action = `/auth/confirm?${new URLSearchParams({ token_hash: token, type: purpose })}`.replace(/&/g, '&amp;')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Activate your Beem Hive account</title><style>body{margin:0;background:#fafafa;color:#111827;font:16px/1.6 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}main{max-width:360px;padding:32px}p{color:#4b5563}button{width:100%;border:0;border-radius:10px;padding:14px;background:#f59e0b;color:#111827;font:600 16px system-ui;cursor:pointer}button:focus-visible{outline:3px solid #111827;outline-offset:4px}.brand{font-weight:700;color:#d97706}</style></head><body><main><span class="brand">Beem Hive</span><h1>Complete your account setup</h1><p>Continue to securely verify this email link and set your password.</p><form method="post" action="${action}"><button type="submit">Continue to password setup</button></form></main></body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } })
}

export async function POST(request) {
  const params = new URL(request.url).searchParams
  const purpose = params.get('type')
  const tokenHash = params.get('token_hash')
  const path = purpose === 'invite' ? '/invite' : '/reset-password'
  const bridge = createClient(request)
  function failed(code) {
    const url = new URL(path, request.url)
    url.searchParams.set('error', code)
    const response = bridge.applyTo(NextResponse.redirect(url))
    response.headers.set('Referrer-Policy', 'no-referrer')
    return clearSetupCookie(response)
  }
  if (!['invite', 'recovery'].includes(purpose) || !tokenHash || tokenHash.length > 512 || !/^[a-zA-Z0-9_-]+$/.test(tokenHash)) {
    return failed('invalid_grant')
  }
  try {
    assertSameOrigin(request)
    const { data, error } = await bridge.supabase.auth.verifyOtp({ token_hash: tokenHash, type: purpose })
    if (error || !data?.user || !data.session) {
      return failed(error?.code === 'otp_expired' ? 'grant_expired' : 'invalid_grant')
    }
    const service = createServiceClient()
    const { role } = await resolveAccount(service, data.user, { allowSetup: true })
    if (role === 'admin' && purpose !== 'recovery') return failed('wrong_role')
    const response = NextResponse.redirect(new URL(path, request.url))
    await issueSetupGrant(service, data.user.id, purpose, response)
    bridge.applyTo(response)
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  } catch (error) {
    if (error.code === 'account_inactive') {
      try { await bridge.supabase.auth.signOut({ scope: 'local' }) } catch { /* Preserve the account denial. */ }
    }
    return failed(error.code || 'grant_issue_failed')
  }
}
