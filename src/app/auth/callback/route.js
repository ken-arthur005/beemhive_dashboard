import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAccount } from '@/lib/auth'
import { roleDestination } from '@/lib/supabase/redirects'

export async function GET(request) {
  const params = new URL(request.url).searchParams
  const bridge = createClient(request)
  function redirect(path, error) {
    const url = new URL(path, request.url)
    if (error) url.searchParams.set('error', error)
    const response = bridge.applyTo(NextResponse.redirect(url))
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  }
  const code = params.get('code')
  if (!code || code.length > 2048) return redirect('/login', 'invalid_callback')
  try {
    const exchanged = await bridge.supabase.auth.exchangeCodeForSession(code)
    if (exchanged.error) return redirect('/login', 'invalid_callback')
    const verified = await bridge.supabase.auth.getUser()
    if (verified.error || !verified.data?.user) return redirect('/login', 'invalid_callback')
    const { role, account } = await resolveAccount(createServiceClient(), verified.data.user, { allowSetup: true })
    if (!role || (role === 'customer' && !account)) return redirect('/login', 'account_pending')
    // A PKCE code (or caller-supplied type/next) never issues a setup capability.
    return redirect(roleDestination(role, params.get('next')))
  } catch (error) {
    if (['account_inactive', 'invalid_role'].includes(error.code)) {
      try { await bridge.supabase.auth.signOut({ scope: 'local' }) } catch { /* Preserve the account denial. */ }
    }
    return redirect('/login', error.code || 'auth_unavailable')
  }
}
