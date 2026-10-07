import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicKey } from './config'
import { HttpError } from '../http'

const responseHeaders = new WeakMap()
const isolatedAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

function boundedFetch(input, init = {}) {
  const timeout = AbortSignal.timeout(20_000)
  return fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout })
}

export function createServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(503, 'The application backend is not configured yet.', 'backend_unconfigured')
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: isolatedAuth,
    global: { fetch: boundedFetch },
  })
}

export function createTokenClient(token) {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, publicKey(), {
    auth: isolatedAuth,
    global: { fetch: boundedFetch, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) },
  })
}

export async function createUserClient(request) {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, publicKey(), {
    global: { fetch: boundedFetch },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet, headers = {}) {
        if (request) responseHeaders.set(request, { ...responseHeaders.get(request), ...headers })
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch (error) {
          // Server Components cannot write cookies; Proxy refreshes their session.
          // Route Handlers must surface all other cookie failures.
          if (!error.message?.includes('Cookies can only be modified')) throw error
        }
      },
    },
  })
}

export function applyUserHeaders(request, response) {
  Object.entries(responseHeaders.get(request) || {}).forEach(([name, value]) => response.headers.set(name, value))
  return response
}

// Transitional privileged interface. Never bind service credentials to user cookies.
export async function createClient() {
  return createServiceClient()
}
