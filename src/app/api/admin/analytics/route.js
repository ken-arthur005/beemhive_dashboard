import { createClient } from '../../../../../lib/supabase/server'
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

  const [itemsRes, tapsRes, usersRes] = await Promise.all([
    supabase.from('nfc_items').select('id, slug, product_type, owner_id, tap_events(count)'),
    supabase.from('tap_events')
      .select('id, created_at, device_type, nfc_item_id')
      .order('created_at', { ascending: false }),
    supabase.auth.admin.listUsers(),
  ])

  if (itemsRes.error) return Response.json({ error: 'Failed to fetch items' }, { status: 500 })
  if (tapsRes.error) return Response.json({ error: 'Failed to fetch taps' }, { status: 500 })
  if (usersRes.error) return Response.json({ error: 'Failed to fetch users' }, { status: 500 })

  const allItems = itemsRes.data ?? []
  const allTaps = tapsRes.data ?? []
  const allUsers = usersRes.data?.users ?? []

  const customerLookup = {}
  for (const u of allUsers) {
    if (u.email) customerLookup[u.id] = u.email
  }

  const itemMap = {}
  for (const item of allItems) {
    itemMap[item.id] = item
  }

  // Leaderboard — sort by all-time tap count, top 10
  const sorted = [...allItems].sort((a, b) => {
    const ca = a.tap_events?.[0]?.count ?? 0
    const cb = b.tap_events?.[0]?.count ?? 0
    return cb - ca
  })
  const leaderboard = sorted.slice(0, 10).map(item => ({
    id: item.id,
    slug: item.slug,
    product_type: item.product_type,
    tap_count: item.tap_events?.[0]?.count ?? 0,
    owner_email: customerLookup[item.owner_id] ?? null,
  }))

  // Device totals — all time
  let mobileTaps = 0
  let desktopTaps = 0
  for (const tap of allTaps) {
    if (tap.device_type === 'mobile') mobileTaps++
    else desktopTaps++
  }

  // Recent activity — latest 20
  const recentActivity = allTaps.slice(0, 20).map(tap => {
    const item = itemMap[tap.nfc_item_id]
    return {
      id: tap.id,
      created_at: tap.created_at,
      device_type: tap.device_type,
      slug: item?.slug ?? null,
      owner_email: item ? (customerLookup[item.owner_id] ?? null) : null,
    }
  })

  return Response.json({
    leaderboard,
    deviceTotals: { mobile: mobileTaps, desktop: desktopTaps },
    recentActivity,
    customerLookup,
  })
}
