import { createClient } from '@/lib/supabase/server'
import { createBrowserClient } from '@supabase/ssr'

function anonClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export async function GET(request) {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: userError } = await anonClient().auth.getUser(token)
  if (userError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: roleData } = await supabase
    .from('users_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Get all customer user_ids
  const { data: roleRows, error: roleError } = await supabase
    .from('users_roles')
    .select('user_id')
    .eq('role', 'customer')

  if (roleError) return Response.json({ error: 'Failed to fetch customers' }, { status: 500 })

  const customerIds = (roleRows ?? []).map(r => r.user_id)

  if (customerIds.length === 0) return Response.json([])

  // Fetch profiles, NFC items, and auth users in parallel
  const [profilesResult, nfcResult, usersResult] = await Promise.all([
    supabase.from('profiles').select('user_id, name, title, bio, photo_url').in('user_id', customerIds),
    supabase.from('nfc_items').select('id, slug, product_type, is_active, owner_id').in('owner_id', customerIds),
    supabase.auth.admin.listUsers(),
  ])

  if (profilesResult.error) return Response.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  if (nfcResult.error) return Response.json({ error: 'Failed to fetch NFC items' }, { status: 500 })
  if (usersResult.error) return Response.json({ error: 'Failed to fetch user data' }, { status: 500 })

  const profileMap = new Map((profilesResult.data ?? []).map(p => [p.user_id, p]))
  const authMap = new Map((usersResult.data?.users ?? []).map(u => [u.id, u]))

  const nfcByOwner = new Map()
  for (const item of (nfcResult.data ?? [])) {
    if (!nfcByOwner.has(item.owner_id)) nfcByOwner.set(item.owner_id, [])
    nfcByOwner.get(item.owner_id).push(item)
  }

  const customers = customerIds.map(id => {
    const authUser = authMap.get(id)
    const profile = profileMap.get(id)
    const nfcItems = nfcByOwner.get(id) ?? []
    return {
      user_id: id,
      email: authUser?.email ?? null,
      created_at: authUser?.created_at ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      email_confirmed_at: authUser?.email_confirmed_at ?? null,
      name: profile?.name ?? null,
      title: profile?.title ?? null,
      bio: profile?.bio ?? null,
      photo_url: profile?.photo_url ?? null,
      nfc_items: nfcItems,
      nfc_item_count: nfcItems.length,
    }
  })

  customers.sort((a, b) => {
    if (!a.created_at) return 1
    if (!b.created_at) return -1
    return Date.parse(b.created_at) - Date.parse(a.created_at)
  })

  return Response.json(customers)
}
