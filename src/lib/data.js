import 'server-only'
import { HttpError } from './http'

export function checked(result) {
  if (result.error) throw result.error
  return result.data
}

export function uuid(value, label = 'Identifier') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, `${label} must be a valid UUID.`, 'invalid_id')
  }
  return value
}

export function revision(value) {
  if (!/^[0-9]+$/.test(String(value)) || BigInt(value) > 9223372036854775807n) throw new HttpError(400, 'A valid record revision is required.')
  return String(value)
}

export function listParameters(request) {
  const params = new URL(request.url).searchParams
  const page = Number(params.get('page') || 1)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) throw new HttpError(400, 'Invalid page.')
  const search = (params.get('search') || '').slice(0, 100).replace(/[^\p{L}\p{N}\s@._+-]/gu, '')
  return { page, search, params, pageSize: 10 }
}

export function analyticsParameters(request) {
  const params = new URL(request.url).searchParams
  const input = params.get('days') || '7'
  const days = input === 'all' ? null : Number(input)
  if (days !== null && ![7, 30, 90].includes(days)) throw new HttpError(400, 'Choose 7, 30, 90 days or all time.')
  const item = params.get('item')
  return { days, item: !item || item === 'all' ? null : uuid(item, 'Item') }
}

export async function allRows(makeQuery) {
  const rows = []
  for (let start = 0; ;) {
    const result = await makeQuery().range(start, start + 999)
    const batch = checked(result) || []
    if (!batch.length) return rows
    rows.push(...batch)
    start += batch.length
    if (Number.isFinite(result.count) && start >= result.count) return rows
  }
}

export async function authDirectory(supabase) {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...(data.users || []))
    if (!data.users.length || (Number.isFinite(data.total) && users.length >= data.total)) return users
  }
}

export async function customerDirectory(supabase) {
  const [users, roles, profiles, accounts, items] = await Promise.all([
    authDirectory(supabase),
    allRows(() => supabase.from('users_roles').select('user_id').eq('role', 'customer').order('user_id')),
    allRows(() => supabase.from('profiles').select('user_id,name,title,bio,photo_asset_id').order('user_id')),
    allRows(() => supabase.from('customer_accounts').select('*').order('user_id')),
    allRows(() => supabase.from('nfc_items').select('id,slug,product_type,owner_id,is_active,retired_at,version').order('id')),
  ])
  const userMap = new Map(users.map(user => [user.id, user]))
  const profileMap = new Map(profiles.map(profile => [profile.user_id, profile]))
  const accountMap = new Map(accounts.map(account => [account.user_id, account]))
  const itemsByOwner = new Map()
  for (const item of items) {
    if (!itemsByOwner.has(item.owner_id)) itemsByOwner.set(item.owner_id, [])
    itemsByOwner.get(item.owner_id).push(item)
  }
  return roles.map(({ user_id }) => {
    const user = userMap.get(user_id)
    const profile = profileMap.get(user_id)
    const account = accountMap.get(user_id)
    const owned = itemsByOwner.get(user_id) || []
    return {
      user_id, email: user?.email || '', name: profile?.name || '', title: profile?.title,
      bio: profile?.bio, photo_url: profile?.photo_asset_id ? `/api/admin/customer-media/${profile.photo_asset_id}` : null, status: account?.status || 'pending',
      setup_completed_at: account?.setup_completed_at, published_revision: account?.published_revision,
      created_at: user?.created_at, last_sign_in_at: user?.last_sign_in_at,
      email_confirmed_at: user?.email_confirmed_at, nfc_items: owned, nfc_item_count: owned.length,
    }
  })
}
