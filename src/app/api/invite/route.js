import { createClient } from '@/lib/supabase/server'
import { createBrowserClient } from '@supabase/ssr'

function anonClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

async function validateAdmin(request) {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

  const { data: { user }, error } = await anonClient().auth.getUser(token)
  if (error || !user) return null

  const supabase = await createClient()
  const { data: roleData } = await supabase
    .from('users_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  return roleData?.role === 'admin' ? supabase : null
}

export async function POST(request) {
  try {
    const supabase = await validateAdmin(request)
    if (!supabase) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { mode, email, customerName, productType, slug } = body

    if (mode === 'resend') {
      if (!email) return Response.json({ error: 'Email required' }, { status: 400 })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/invite`,
      })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true })
    }

    if (!email || !customerName || !productType || !slug) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('nfc_items')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) return Response.json({ error: 'slug_taken' }, { status: 409 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: customerName },
        redirectTo: `${appUrl}/invite`,
      }
    )
    if (inviteError) {
      const status = inviteError.status === 429 ? 429 : 500
      return Response.json({ error: inviteError.message, code: inviteError.code }, { status })
    }

    const userId = inviteData?.user?.id
    if (!userId) return Response.json({ error: 'Invite succeeded but user ID was missing in response' }, { status: 500 })

    const { data: nfcItem, error: nfcError } = await supabase
      .from('nfc_items')
      .insert({ slug, product_type: productType, owner_id: userId, is_active: true })
      .select()
      .single()

    if (nfcError) {
      console.error('[invite] nfc_items insert error:', nfcError)
      return Response.json({ error: nfcError.message }, { status: 500 })
    }

    const { error: profileError } = await supabase.from('profiles').insert({ user_id: userId, name: customerName })
    if (profileError) console.error('[invite] profiles insert error:', profileError)

    const { error: roleError } = await supabase.from('users_roles').insert({ user_id: userId, role: 'customer' })
    if (roleError) console.error('[invite] users_roles insert error:', roleError)

    return Response.json({
      item: { ...nfcItem, ownerEmail: email, tapCount: 0 },
    })
  } catch (err) {
    console.error('[invite] unhandled exception:', err)
    return Response.json({ error: 'Internal server error', detail: err?.message }, { status: 500 })
  }
}
