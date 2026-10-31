import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { HttpError } from './http'

export const VISITOR_COOKIE = 'beem_visitor'

function secret() {
  const value = process.env.ANALYTICS_SECRET || process.env.IP_HASH_SALT
  if (!value || value.length < 32) throw new HttpError(503, 'Visitor analytics is not configured.', 'analytics_unavailable')
  return value
}
const signature = id => createHmac('sha256', secret()).update(`cookie:v1:${id}`).digest('base64url')

export function visitorIdentity(headers, create = false) {
  const token = headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${VISITOR_COOKIE}=`))?.slice(VISITOR_COOKIE.length + 1)
  const match = /^([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/.exec(token || '')
  if (match && timingSafeEqual(Buffer.from(match[2]), Buffer.from(signature(match[1])))) return { id: match[1], token, fresh: false }
  if (!create) return null
  const id = randomUUID()
  return { id, token: `${id}.${signature(id)}`, fresh: true }
}

export function visitorHash(identity) {
  return createHmac('sha256', secret()).update(`visitor:v1:${identity.id}`).digest('hex')
}
