import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ ssr: vi.fn(), browser: vi.fn(), js: vi.fn(), cookies: vi.fn(), options: null, client: null }))
vi.mock('server-only', () => ({}))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.ssr, createBrowserClient: mocks.browser }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.js }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))

import { createServiceClient, createUserClient, createClient as legacyClient, applyUserHeaders } from '../src/lib/supabase/server'
import { createClient as browserClient } from '../src/lib/supabase/client'
import { createClient as bridgeClient } from '../src/lib/supabase/middleware'
import { proxy, config } from '../src/proxy'
import { GET as callback } from '../src/app/auth/callback/route'
import { POST as confirm, GET as confirmPreview } from '../src/app/auth/confirm/route'

const cacheHeaders = { 'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0', Expires: '0', Pragma: 'no-cache' }
const refreshedCookie = { name: 'sb-session', value: 'fresh', options: { path: '/', httpOnly: true } }

function service(role = 'customer', status = 'active') {
  return { rpc: vi.fn(async () => ({ error: null })), from: vi.fn(table => {
    const chain = {
      select: () => chain, eq: () => chain,
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: table === 'users_roles' ? { role } : { status } }),
      insert: vi.fn(async () => ({ error: null })),
    }
    return chain
  }) }
}

describe('client boundaries and refresh propagation', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.test')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-secret')
    mocks.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() })
    mocks.client = { auth: {
      getUser: vi.fn(async () => {
        mocks.options.cookies.setAll([refreshedCookie], cacheHeaders)
        return { data: { user: { id: 'user' } } }
      }),
      signOut: vi.fn(async () => {
        mocks.options.cookies.setAll([{ ...refreshedCookie, value: '', options: { path: '/', maxAge: 0 } }], cacheHeaders)
        return { error: null }
      }),
      exchangeCodeForSession: vi.fn(async () => ({ data: {}, error: null })),
      verifyOtp: vi.fn(async () => {
        mocks.options.cookies.setAll([refreshedCookie], cacheHeaders)
        return { data: { user: { id: 'user' }, session: { access_token: 'verified' } }, error: null }
      }),
    } }
    mocks.ssr.mockImplementation((url, key, options) => { mocks.options = options; return mocks.client })
    mocks.js.mockReturnValue(service())
  })

  it('makes service clients sync and isolated; legacy createClient remains async privileged', async () => {
    const privileged = createServiceClient()
    expect(privileged).not.toBeInstanceOf(Promise)
    expect(mocks.js).toHaveBeenCalledWith('https://project.test', 'service-secret', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: expect.any(Function) },
    })
    expect(await legacyClient()).toBe(privileged)
    expect(mocks.cookies).not.toHaveBeenCalled()
  })
  it('uses publishable credentials for browser and cookie clients with anon fallback', async () => {
    browserClient()
    await createUserClient()
    expect(mocks.browser).toHaveBeenCalledWith('https://project.test', 'publishable')
    expect(mocks.ssr.mock.calls[0][1]).toBe('publishable')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')
    browserClient()
    expect(mocks.browser).toHaveBeenLastCalledWith('https://project.test', 'anon')
  })
  it('route user clients write cookies and preserve SSR cache headers', async () => {
    const store = { getAll: () => [], set: vi.fn() }
    mocks.cookies.mockResolvedValue(store)
    const request = new Request('https://app.test/api/auth/session')
    const client = await createUserClient(request)
    await client.auth.getUser()
    expect(store.set).toHaveBeenCalledWith('sb-session', 'fresh', refreshedCookie.options)
    const response = applyUserHeaders(request, new Response())
    expect(response.headers.get('expires')).toBe('0')
    expect(response.headers.get('pragma')).toBe('no-cache')
  })
  it('returns the current refreshed response, updates downstream cookies, and accumulates multiple writes', async () => {
    const request = new NextRequest('https://app.test/customer/profile', { headers: { cookie: 'sb-session=old' } })
    const bridge = bridgeClient(request)
    await bridge.supabase.auth.getUser()
    mocks.options.cookies.setAll([{ name: 'second', value: 'value', options: { path: '/' } }], {})
    const response = bridge.response
    expect(request.cookies.get('sb-session').value).toBe('fresh')
    expect(response.cookies.get('sb-session').value).toBe('fresh')
    expect(response.cookies.get('second').value).toBe('value')
    expect(response.headers.get('cache-control')).toBe(cacheHeaders['Cache-Control'])
    expect(response.headers.get('x-middleware-request-cookie')).toContain('sb-session=fresh')
  })
  it('retains cookies/cache headers on wrong-role redirects without middleware control headers', async () => {
    mocks.js.mockReturnValue(service('admin'))
    const response = await proxy(new NextRequest('https://app.test/customer/profile'))
    expect(response.headers.get('location')).toBe('https://app.test/admin/nfc-items')
    expect(response.cookies.get('sb-session').value).toBe('fresh')
    expect(response.headers.get('expires')).toBe('0')
    expect(response.headers.has('x-middleware-next')).toBe(false)
  })
  it('signs out suspended sessions and carries deletion cookies on the login redirect', async () => {
    mocks.js.mockReturnValue(service('customer', 'suspended'))
    const response = await proxy(new NextRequest('https://app.test/customer/profile'))
    expect(response.headers.get('location')).toBe('https://app.test/login?error=account_inactive')
    expect(response.cookies.get('sb-session').value).toBe('')
    expect(mocks.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(response.headers.get('pragma')).toBe('no-cache')
  })
  it('does not globally block incomplete customer drafts', async () => {
    const response = await proxy(new NextRequest('https://app.test/customer/profile'))
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
  it('limits Auth refresh to dashboard/auth routes and public request-method tagging', () => {
    expect(config.matcher).not.toContain('/api/:path*')
    expect(config.matcher.every(path => /^\/(admin|customer|login|invite|forgot-password|reset-password|auth|t)(\/|$)/.test(path))).toBe(true)
  })
  it('PKCE rejects malicious next and never grants setup from unchecked type', async () => {
    const response = await callback(new NextRequest('https://app.test/auth/callback?code=code&next=//evil.test&type=invite'))
    expect(response.headers.get('location')).toBe('https://app.test/customer/profile')
    expect(response.cookies.get('beem_setup_grant')).toBeUndefined()
    expect(response.cookies.get('sb-session').value).toBe('fresh')
    expect(mocks.client.auth.verifyOtp).not.toHaveBeenCalled()
  })
  it('retains refresh headers even on failed PKCE callbacks', async () => {
    mocks.client.auth.exchangeCodeForSession.mockImplementation(async () => {
      mocks.options.cookies.setAll([refreshedCookie], cacheHeaders)
      return { error: { code: 'invalid' } }
    })
    const response = await callback(new NextRequest('https://app.test/auth/callback?code=bad'))
    expect(response.headers.get('location')).toContain('error=invalid_callback')
    expect(response.cookies.get('sb-session').value).toBe('fresh')
    expect(response.headers.get('pragma')).toBe('no-cache')
  })
  it('confirm verifies invite on server, inserts hashed grant, then issues HttpOnly cookie', async () => {
    const inserted = vi.fn(async () => ({ error: null }))
    const privileged = service()
    const original = privileged.from
    privileged.from = vi.fn(table => table === 'setup_grants' ? { insert: inserted } : original(table))
    mocks.js.mockReturnValue(privileged)
    const response = await confirm(new NextRequest('https://app.test/auth/confirm?token_hash=otp&type=invite&next=//evil.test', { method: 'POST', headers: { Origin: 'https://app.test' } }))
    expect(mocks.client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'otp', type: 'invite' })
    const cookie = response.cookies.get('beem_setup_grant')
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe('lax')
    expect(inserted.mock.calls[0][0]).toMatchObject({ user_id: 'user', purpose: 'invite', consumed_at: null })
    expect(inserted.mock.calls[0][0].token_hash).not.toBe(cookie.value)
    expect(response.headers.get('location')).toBe('https://app.test/invite')
    expect(response.status).toBe(303)
    expect(privileged.rpc).toHaveBeenCalledWith('ensure_customer', { p_user_id: 'user', p_name: 'Beem Hive customer' })
    expect(response.headers.get('expires')).toBe('0')
    expect(response.cookies.get('sb-session').value).toBe('fresh')
  })
  it('does not issue a usable cookie when grant persistence fails after OTP success', async () => {
    const privileged = service()
    const original = privileged.from
    privileged.from = table => table === 'setup_grants' ? { insert: async () => ({ error: { code: 'XX000' } }) } : original(table)
    mocks.js.mockReturnValue(privileged)
    const response = await confirm(new NextRequest('https://app.test/auth/confirm?token_hash=otp&type=recovery', { method: 'POST', headers: { Origin: 'https://app.test' } }))
    expect(response.headers.get('location')).toContain('error=grant_issue_failed')
    expect(response.cookies.get('beem_setup_grant').value).toBe('')
  })
  it('GET confirmation does not consume an OTP when an email scanner follows the link', async () => {
    const response = await confirmPreview(new NextRequest('https://app.test/auth/confirm?token_hash=otp&type=invite'))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('method="post"')
    expect(mocks.client.auth.verifyOtp).not.toHaveBeenCalled()
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin')
  })
  it('HEAD profile requests are marked without refreshing Auth or accepting a spoofed method header', async () => {
    const response = await proxy(new NextRequest('https://app.test/t/card-one', { method: 'HEAD', headers: { 'x-beem-request-method': 'GET' } }))
    expect(response.headers.get('x-middleware-request-x-beem-request-method')).toBe('HEAD')
    expect(mocks.client.auth.getUser).not.toHaveBeenCalled()
  })
  it.each(['email', 'signup', 'magiclink', ''])('confirm refuses unrelated OTP purpose %s', async type => {
    const response = await confirmPreview(new NextRequest(`https://app.test/auth/confirm?token_hash=otp&type=${type}`))
    expect(mocks.client.auth.verifyOtp).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toContain('error=invalid_grant')
  })
  it('applies refresh cookies to explicit redirect responses', async () => {
    const bridge = bridgeClient(new NextRequest('https://app.test/login'))
    await bridge.supabase.auth.getUser()
    expect(bridge.applyTo(NextResponse.redirect('https://app.test/customer/profile')).cookies.get('sb-session').value).toBe('fresh')
  })
  it('rejects null and external POST origins before verifying an OTP, with a GET-safe error redirect', async () => {
    for (const origin of ['null', 'https://untrusted.test']) {
      const response = await confirm(new NextRequest('https://app.test/auth/confirm?token_hash=otp&type=invite', { method: 'POST', headers: { Origin: origin } }))
      expect(response.status).toBe(303)
      expect(response.headers.get('location')).toContain('error=invalid_origin')
    }
    expect(mocks.client.auth.verifyOtp).not.toHaveBeenCalled()
  })
})
