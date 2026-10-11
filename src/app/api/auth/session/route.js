import 'server-only'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { apiError } from '@/lib/http'
import { applyUserHeaders, createUserClient } from '@/lib/supabase/server'
import { hasPublishedProfile } from '@/lib/publication-history'

export async function GET(request) {
  try {
    const auth = await requireUser(request, { allowSetup: true })
    const { user, role, account } = auth
    const hasPublished = await hasPublishedProfile(auth)
    return applyUserHeaders(request, NextResponse.json({
      user: { id: user.id, email: user.email ?? null }, role, account,
      pending: !role || (role === 'customer' && !account),
      setupRequired: role === 'customer' && !account?.setup_completed_at,
      hasPublished,
    }, { headers: { 'Cache-Control': 'private, no-store' } }))
  } catch (error) {
    if (['account_inactive', 'invalid_role'].includes(error.code) && !request.headers.has('authorization')) {
      try { await (await createUserClient(request)).auth.signOut({ scope: 'local' }) } catch { /* Preserve the account denial. */ }
    }
    return applyUserHeaders(request, apiError(error))
  }
}
