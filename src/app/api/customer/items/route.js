import { requireUser } from '@/lib/auth'
import { apiError, jsonResponse } from '@/lib/http'
import { checked } from '@/lib/data'
import { itemUrl } from '@/lib/platform'

export async function GET(request) {
  try {
    const { user, account, supabase } = await requireUser(request, { role: 'customer' })
    const [items, stats] = await Promise.all([
      supabase.from('nfc_items').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }).then(checked),
      supabase.rpc('analytics_summary', { p_customer: user.id, p_days: null, p_item: null }).then(checked),
    ])
    const counts = new Map(stats.cards.map(card => [card.id, card]))
    return jsonResponse({ items: items.map(item => ({ ...item, ...counts.get(item.id), url: itemUrl(item.slug),
      is_public: Boolean(item.is_active && !item.retired_at && account.setup_completed_at && account.published_revision != null),
      published_revision: account.published_revision,
    })) })
  } catch (error) { return apiError(error) }
}
