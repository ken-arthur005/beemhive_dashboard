import { NextResponse } from 'next/server'
import { apiError, assertSameOrigin, HttpError, readJson } from '@/lib/http'
import { checked, uuid, revision } from '@/lib/data'
import { eventContext } from '@/lib/public-profile'
import { visitorIdentity, visitorHash, VISITOR_COOKIE } from '@/lib/visitor'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    assertSameOrigin(request)
    const context = eventContext(request.headers)
    if (!context.qualified) return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
    const body = await readJson(request, 4096)
    if (typeof body.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(body.slug) || !['profile_view','link_click'].includes(body.type)) throw new HttpError(400, 'Invalid profile event.')
    if (body.type === 'link_click' && (!Number.isInteger(body.linkIndex) || body.linkIndex < 0 || body.linkIndex > 7)) throw new HttpError(400, 'Invalid link.')
    const identity = visitorIdentity(request.headers, body.type === 'profile_view')
    if (!identity) return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
    // Fetch's Referer is our own profile URL; use the document's original source
    // and retain only an HTTP(S) origin, never private paths or query strings.
    let referrer = null
    try {
      const source = typeof body.referrer === 'string' && body.referrer.length <= 2048 ? new URL(body.referrer) : null
      if (source && ['http:','https:'].includes(source.protocol)) referrer = source.origin
    } catch { /* Direct visit or invalid referrer. */ }
    const recorded = checked(await createServiceClient().rpc('record_profile_interaction', {
      p_slug: body.slug, p_event_type: body.type, p_visitor_hash: visitorHash(identity), p_device_type: context.device,
      p_referrer: referrer, p_event_id: uuid(body.eventId), p_visit_id: uuid(body.visitId),
      p_revision: revision(body.revision), p_link_index: body.type === 'link_click' ? body.linkIndex : null,
    }))
    const response = NextResponse.json({ recorded }, { headers: { 'Cache-Control': 'private, no-store' } })
    if (identity.fresh && recorded) response.cookies.set(VISITOR_COOKIE, identity.token, {
      httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch (error) { return apiError(error) }
}
