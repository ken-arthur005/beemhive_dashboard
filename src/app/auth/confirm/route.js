import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAccount } from '@/lib/auth'
import { issueSetupGrant, clearSetupCookie } from '@/lib/supabase/setup-grants'
import { assertSameOrigin } from '@/lib/http'
import { provisionVerifiedInvite } from '@/lib/supabase/invitations'

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
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Activate your Beem Hive account</title><style>
    *{box-sizing:border-box}body{margin:0;background:#ecebe4;color:#242820;font:14px/1.7 system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center;padding:20px}
    main{width:100%;max-width:440px;padding:40px;background:#fdfcf8;border:1px solid #e3e1d7;border-radius:28px;box-shadow:0 20px 70px #3d362710}
    .brand{font-size:20px;font-weight:700;letter-spacing:-1px}.brand span{color:#a77a12}.eyebrow{margin-top:44px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#737269}
    h1{font-size:34px;font-weight:500;letter-spacing:-1.5px;line-height:1.15;margin:14px 0}p{color:#737269}form{margin-top:28px}
    button{width:100%;border:0;border-radius:99px;padding:15px;background:#f3c442;color:#292718;font:600 13px system-ui;cursor:pointer}button:hover{background:#ffda63}button:focus-visible{outline:2px solid #89600e;outline-offset:4px}
    footer{border-top:1px solid #e3e1d7;padding-top:20px;margin-top:32px;color:#737269;font-size:11px}
    @media(prefers-color-scheme:dark){body{background:#141815;color:#f5f3e9}main{background:#202620;border-color:#ffffff20}p,.eyebrow,footer{color:#aaa99d}footer{border-color:#ffffff20}.brand span{color:#f3c442}}
  </style></head><body><main><div class="brand">Beem<span> Hive</span></div><p class="eyebrow">Your next connection starts here</p><h1>Complete your account setup</h1><p>Continue to securely verify this email link and set your password.</p><form method="post" action="${action}"><button type="submit">Continue to password setup</button></form><footer>A little tap. A world of possibility.</footer></main></body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'strict-origin', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } })
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
    const response = bridge.applyTo(NextResponse.redirect(url, 303))
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
    // Only a verified invite (or recovery of an Auth-invited account) can
    // bootstrap application membership. Request fields never choose a role.
    if (purpose === 'invite' || (purpose === 'recovery' && data.user.invited_at)) {
      await provisionVerifiedInvite(service, data.user)
    }
    const { role } = await resolveAccount(service, data.user, { allowSetup: true })
    if (role === 'admin' && purpose !== 'recovery') return failed('wrong_role')
    const response = NextResponse.redirect(new URL(path, request.url), 303)
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
