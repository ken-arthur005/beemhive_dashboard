import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { publicKey } from './config'

export function createClient(request) {
  const pendingCookies = new Map()
  const pendingHeaders = new Headers({ 'Cache-Control': 'private, no-store' })

  function applyTo(response) {
    pendingCookies.forEach(cookie => response.cookies.set(cookie.name, cookie.value, cookie.options))
    pendingHeaders.forEach((value, name) => response.headers.set(name, value))
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers = {}) {
          cookiesToSet.forEach(cookie => {
            request.cookies.set(cookie.name, cookie.value)
            pendingCookies.set(cookie.name, cookie)
          })
          Object.entries(headers).forEach(([name, value]) => pendingHeaders.set(name, value))
        },
      },
    }
  )

  return {
    supabase,
    applyTo,
    // Evaluate after getUser(), never capture a stale response before refresh.
    get response() { return applyTo(NextResponse.next({ request: { headers: request.headers } })) },
  }
}
