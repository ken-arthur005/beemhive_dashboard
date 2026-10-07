import { afterEach, expect, test, vi } from 'vitest'
import sharp from 'sharp'
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))
import { eventContext } from '../src/lib/public-profile.js'
import { safePhoto } from '../src/lib/media.js'

afterEach(() => vi.unstubAllEnvs())
test('analytics avoids raw IPs and personal referrer paths and rejects prefetched/bot visits', () => {
  vi.stubEnv('IP_HASH_SALT', 'a'.repeat(32))
  const headers = new Headers({ 'user-agent': 'iPhone Mobile', 'x-forwarded-for': '192.0.2.10', referer: 'https://example.com/private?email=person@example.com' })
  const context = eventContext(headers)
  expect(context).toMatchObject({ device: 'mobile', qualified: true, referrer: 'https://example.com' })
  expect(context.ipHash).toHaveLength(64)
  expect(context.ipHash).not.toContain('192.0.2.10')
  headers.set('x-beem-request-method', 'HEAD')
  expect(eventContext(headers).qualified).toBe(false)
  headers.delete('x-beem-request-method')
  headers.set('purpose', 'prefetch')
  expect(eventContext(headers).qualified).toBe(false)
  headers.delete('purpose')
  headers.set('user-agent', 'Googlebot')
  expect(eventContext(headers).qualified).toBe(false)
  vi.stubEnv('IP_HASH_SALT', '')
  expect(eventContext(headers).ipHash).toBeNull()
})

test('photo sanitization detects real formats, strips metadata and refuses SVG/GIF', async () => {
  const png = await sharp({ create: { width: 1200, height: 600, channels: 3, background: '#f59e0b' } }).png().toBuffer()
  const jpeg = await safePhoto(png)
  const info = await sharp(jpeg).metadata()
  expect(info).toMatchObject({ format: 'jpeg', width: 800, height: 400 })
  expect(info.exif).toBeUndefined()
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
  await expect(safePhoto(svg)).rejects.toThrow('Upload a single JPG, PNG or WebP')
  await expect(safePhoto(Buffer.from('not an image'))).rejects.toThrow()
})
