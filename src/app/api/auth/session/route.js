import 'server-only'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { apiError } from '@/lib/http'
import { applyUserHeaders, createUserClient } from '@/lib/supabase/server'

export async function GET(request) {
  try {
    const { user, role, account } = await requireUser(request, { allowSetup: true })
    return applyUserHeaders(request, NextResponse.json({
      user: { id: user.id, email: user.email ?? null }, role, account,
      pending: !role || (role === 'customer' && !account),
      setupRequired: role === 'customer' && !account?.setup_completed_at,
    }, { headers: { 'Cache-Control': 'private, no-store' } }))
  } catch (error) {
    if (['account_inactive', 'invalid_role'].includes(error.code) && !request.headers.has('authorization')) {
      try { await (await createUserClient(request)).auth.signOut({ scope: 'local' }) } catch { /* Preserve the account denial. */ }
    }
    return applyUserHeaders(request, apiError(error))
  }
}
