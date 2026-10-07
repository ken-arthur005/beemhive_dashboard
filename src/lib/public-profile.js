import 'server-only'
import { createHmac } from 'node:crypto'
import { createServiceClient } from './supabase/server'
import { checked } from './data'

export function eventContext(headers) {
  const agent = headers.get('user-agent') || ''
  const device = /ipad|tablet/i.test(agent) ? 'tablet' : /mobile|android|iphone/i.test(agent) ? 'mobile' : agent ? 'desktop' : 'unknown'
  const salt = process.env.IP_HASH_SALT
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ipHash = salt?.length >= 32 && ip ? createHmac('sha256', salt).update(ip).digest('hex') : null
  let referrer = null
  try { referrer = new URL(headers.get('referer')).origin } catch { /* No referrer or invalid URL. */ }
  const qualified = headers.get('x-beem-request-method') !== 'HEAD' && !/bot|crawl|spider|preview|facebookexternalhit|slackbot|whatsapp/i.test(agent) &&
    !headers.get('next-router-prefetch') && !headers.get('purpose')?.includes('prefetch') && !headers.get('sec-purpose')?.includes('prefetch')
  return { device, ipHash, referrer, qualified }
}

export async function publicProfile(slug, headers, eventType = null) {
  const supabase = createServiceClient()
  const context = eventContext(headers)
  const shouldRecord = eventType && (eventType === 'contact_download' || context.qualified)
  const profile = checked(await supabase.rpc(shouldRecord ? 'fetch_public_profile' : 'resolve_public_profile', shouldRecord ? {
    p_slug: slug, p_event_type: eventType, p_ip_hash: context.ipHash, p_device_type: context.device, p_referrer: context.referrer,
  } : { p_slug: slug }))
  return { profile, supabase }
}
