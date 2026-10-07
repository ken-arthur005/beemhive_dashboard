import 'server-only'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { HttpError, apiError, assertSameOrigin, readJson } from '@/lib/http'
import { applyUserHeaders } from '@/lib/supabase/server'
import { readSetupGrant, completeSetup, clearSetupCookie } from '@/lib/supabase/setup-grants'

const noStore = { 'Cache-Control': 'private, no-store' }

function failure(request, error) {
  const result = NextResponse.json({ error: error.message, code: error.code }, {
    status: error.status, headers: noStore,
  })
  if (['grant_missing', 'invalid_grant', 'grant_expired', 'account_inactive'].includes(error.code)) clearSetupCookie(result)
  return applyUserHeaders(request, result)
}

export async function GET(request) {
  try {
    const auth = await requireUser(request, { allowSetup: true })
    const purpose = new URL(request.url).searchParams.get('purpose')
    if (!['invite', 'recovery'].includes(purpose)) throw new HttpError(400, 'Invalid setup purpose.', 'invalid_grant')
    const grant = await readSetupGrant(auth.supabase, auth.user.id, purpose)
    if (auth.role === 'admin' && grant.purpose !== 'recovery') throw new HttpError(403, 'Use an administrator recovery link.', 'wrong_role')
    return applyUserHeaders(request, NextResponse.json({
      state: grant.consumed_at ? 'completed' : (auth.role === 'admin' || (auth.account && auth.role) ? 'ready' : 'pending'),
      next: auth.role === 'admin' ? '/admin/nfc-items' : '/customer/profile',
      purpose: grant.purpose, expiresAt: grant.expires_at,
      passwordUpdated: Boolean(grant.password_updated_at),
    }, { headers: noStore }))
  } catch (error) {
    return error instanceof HttpError ? failure(request, error) : applyUserHeaders(request, apiError(error))
  }
}

export async function POST(request) {
  try {
    assertSameOrigin(request)
    // The grant and its verified Auth session must travel together in cookies.
    if (request.headers.has('authorization')) throw new HttpError(403, 'Open your setup email in this browser to continue.', 'invalid_grant')
    const { password } = await readJson(request, 2048)
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw new HttpError(400, 'Password must contain 8 to 128 characters.', 'invalid_password')
    }
    const auth = await requireUser(request, { allowSetup: true })
    const grant = await readSetupGrant(auth.supabase, auth.user.id)
    await completeSetup(auth, grant, password)
    const response = NextResponse.json({ success: true, next: auth.role === 'admin' ? '/admin/nfc-items' : '/customer/profile' }, { headers: noStore })
    return applyUserHeaders(request, clearSetupCookie(response))
  } catch (error) {
    return error instanceof HttpError ? failure(request, error) : applyUserHeaders(request, apiError(error))
  }
}
