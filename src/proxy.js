import { NextResponse } from 'next/server'
import { createClient } from './lib/supabase/middleware'
import { createServiceClient } from './lib/supabase/server'
import { resolveAccount } from './lib/auth'
import { hasPublishedProfile } from './lib/publication-history'
import { roleDestination } from './lib/supabase/redirects'

export async function proxy(request) {
  if (request.nextUrl.pathname.startsWith('/t/')) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-beem-request-method', request.method)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }
  const bridge = createClient(request)
  const { data, error } = await bridge.supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const requiredRole = pathname === '/admin' || pathname.startsWith('/admin/') ? 'admin'
    : pathname === '/customer' || pathname.startsWith('/customer/') ? 'customer' : null
  if (!requiredRole) return bridge.response

  function redirect(path, code) {
    const url = new URL(path, request.url)
    if (code) url.searchParams.set('error', code)
    if (path === '/login' && !code) url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return bridge.applyTo(NextResponse.redirect(url))
  }

  if (error || !data?.user) return redirect('/login', error?.status >= 500 ? 'auth_unavailable' : undefined)
  try {
    const auth = await resolveAccount(createServiceClient(), data.user)
    if (auth.role !== requiredRole) return redirect(roleDestination(auth.role, null, { hasPublished: await hasPublishedProfile(auth) }))
  } catch (failure) {
    if (failure.code === 'account_inactive' || failure.code === 'invalid_role') {
      try { await bridge.supabase.auth.signOut({ scope: 'local' }) } catch { /* Preserve the account denial. */ }
    }
    return redirect('/login', failure.code || 'account_unavailable')
  }
  return bridge.response
}

export const config = {
  matcher: ['/admin/:path*', '/customer/:path*', '/login', '/invite', '/forgot-password', '/reset-password', '/auth/:path*', '/t/:path*'],
}
