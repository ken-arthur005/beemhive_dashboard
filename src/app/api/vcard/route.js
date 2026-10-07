import { publicProfile } from '@/lib/public-profile'
import { vcard } from '@/lib/contact'
import { apiError, HttpError } from '@/lib/http'

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams
    const slug = params.get('slug')
    if (!slug || params.has('userId')) throw new HttpError(400, 'An NFC item slug is required.')
    const { profile } = await publicProfile(slug, request.headers, request.method === 'HEAD' ? null : 'contact_download')
    if (!profile || !profile.content.show_save_contact) throw new HttpError(404, 'This contact is not available.')
    const filename = profile.content.name.replace(/[^a-z0-9 -]/gi, '').trim().slice(0, 80) || 'contact'
    return new Response(vcard(profile.content), { headers: { 'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.vcf"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) { return apiError(error) }
}
