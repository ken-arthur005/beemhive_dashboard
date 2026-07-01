import { createClient } from '@/lib/supabase/server'
import { createBrowserClient } from '@supabase/ssr'

function anonClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

function mapApiError(err) {
  if (!err) return 'Something went wrong.'
  const msg = typeof err === 'string' ? err : (err.message ?? '')
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'This email is already registered.'
  return 'Something went wrong. Please try again.'
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

  const { data: items, error: itemsError } = await supabase
    .from('nfc_items')
    .select('*, tap_events(count)')
    .order('created_at', { ascending: false })

  if (itemsError) return Response.json({ error: 'Failed to fetch items' }, { status: 500 })

  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  const emailMap = new Map(usersError ? [] : users.map(u => [u.id, u.email]))

  const result = items.map(item => ({
    ...item,
    ownerEmail: item.owner_id ? (emailMap.get(item.owner_id) ?? null) : null,
    tapCount: item.tap_events?.[0]?.count ?? 0,
    tap_events: undefined,
  }))

  return Response.json(result)
}
