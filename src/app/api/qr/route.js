import QRCode from 'qrcode'
import { requireUser } from '@/lib/auth'
import { checked } from '@/lib/data'
import { apiError, HttpError } from '@/lib/http'
import { itemUrl } from '@/lib/platform'

export const runtime = 'nodejs'

export async function GET(request) {
  try {
    const { user, role, supabase } = await requireUser(request)
    const slug = new URL(request.url).searchParams.get('slug')
    if (!slug || slug.length > 64) throw new HttpError(400, 'An item slug is required.')
    let query = supabase.from('nfc_items').select('slug,owner_id').eq('slug', slug)
    if (role !== 'admin') query = query.eq('owner_id', user.id)
    const item = checked(await query.maybeSingle())
    if (!item) throw new HttpError(404, 'Item not found.')
    const buffer = await QRCode.toBuffer(itemUrl(item.slug), { type: 'png', width: 768, margin: 4, errorCorrectionLevel: 'M' })
    return new Response(buffer, { headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${item.slug}-qr.png"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) { return apiError(error) }
}
