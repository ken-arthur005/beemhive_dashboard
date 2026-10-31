import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createHarness, ids } from './database-harness'

let db
beforeAll(async () => { db = await createHarness(process.env.TEST_DATABASE_URL) }, 60000)
afterAll(async () => { if (db) await db.close() }, 30000)

async function ready() {
  const c = await db.customer({ publish: false })
  const draft = { ...c.draft, photo_shape: 'circle', links: [{ id: 'custom', type: 'custom', label: 'Book me', url: 'https://example.com/book' }, { id: 'snap', type: 'snapchat', url: 'https://snapchat.com/add/test' }] }
  const saved = await db.rpc('save_profile_draft', [c.user, c.revision, draft])
  await db.rpc('publish_profile', [c.user, saved.revision])
  const item = await db.item(c.user)
  return { ...c, draft, revision: saved.revision, item }
}
async function event(c, visitor = 'a', type = 'profile_view', visit = randomUUID(), eventId = randomUUID(), index = null) {
  return db.rpc('record_profile_interaction', [c.item.slug,type,visitor.repeat(64),'mobile',null,eventId,visit,c.revision,index])
}

test('new portrait styles, custom names and Snapchat survive CAS save and immutable publication', async () => {
  const c = await ready()
  const resolved = await db.rpc('resolve_public_profile', [c.item.slug])
  expect(resolved.content).toMatchObject({ photo_shape: 'circle', links: [{ label: 'Book me' }, { type: 'snapchat' }] })
  await expect(db.rpc('save_profile_draft', [c.user,c.revision,{ ...c.draft, photo_shape: 'bad' }])).rejects.toMatchObject({ code: '22023' })
  const saved = await db.rpc('save_profile_draft', [c.user,c.revision,{ ...c.draft, photo_shape: 'square' }])
  expect(saved.photo_shape).toBe('square')
  expect((await db.rpc('resolve_public_profile', [c.item.slug])).content.photo_shape).toBe('circle')
  await db.rpc('publish_profile', [c.user,saved.revision])
  expect((await db.rpc('resolve_public_profile', [c.item.slug])).content.photo_shape).toBe('square')
})

test('incomplete phone drafts are retained but publication requires international numbers', async () => {
  const c = await db.customer({ publish: false })
  const draft = { ...c.draft, links: [{ type: 'phone', url: '+2', phone_country: 'GH' }] }
  const saved = await db.rpc('save_profile_draft', [c.user,c.revision,draft])
  await expect(db.rpc('publish_profile', [c.user,saved.revision])).rejects.toMatchObject({ code: '22023' })
  const valid = await db.rpc('save_profile_draft', [c.user,saved.revision,{ ...draft, links: [{ type: 'phone', url: '+233241234567', phone_country: 'GH' }] }])
  expect((await db.rpc('publish_profile', [c.user,valid.revision])).content.links[0].url).toBe('+233241234567')
})

test('repeat visits grow totals once per event, while period uniques and conversion rates stay deduplicated', async () => {
  const c = await ready()
  const visit = randomUUID(), eventId = randomUUID()
  const results = await Promise.all(Array.from({ length: 8 }, () => event(c,'a','profile_view',visit,eventId)))
  expect(results.filter(Boolean)).toHaveLength(1)
  await event(c,'a')
  await event(c,'b')
  await event(c,'a','link_click',visit,randomUUID(),0)
  await event(c,'a','link_click',visit,randomUUID(),1)
  await event(c,'a','contact_download')
  await event(c,'a','contact_download')
  await db.rpc('record_profile_event', [c.item.slug,'profile_view',null,'desktop',null])
  const stats = await db.rpc('analytics_summary', [c.user,7,null])
  expect(stats).toMatchObject({ totalTaps: 4, uniqueVisitors: 2, repeatVisitors: 1, totalClicks: 2, uniqueClickers: 1, uniqueCtr: 50, contactDownloads: 2, uniqueContactSavers: 1, contactConversionRate: 50, legacyViews: 1, trackedViews: 3 })
  expect(stats.daily.at(-1)).toMatchObject({ taps: 4, uniqueVisitors: 2 })
  expect(stats.cards[0].uniqueVisitors).toBe(2)
})

test('period uniques are not a sum of daily uniques and cross-period clicks cannot inflate CTR', async () => {
  const c = await ready()
  const visit = randomUUID(), oldEvent = randomUUID()
  await event(c,'a','profile_view',visit,oldEvent)
  await db.service("UPDATE public.tap_events SET created_at=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')-interval '1 day' WHERE event_id=$1", [oldEvent])
  await event(c,'a')
  await event(c,'b')
  await event(c,'a','link_click',visit,randomUUID(),0)
  const outsider = randomUUID(), outsiderEvent = randomUUID()
  await event(c,'c','profile_view',outsider,outsiderEvent)
  await db.service("UPDATE public.tap_events SET created_at=now()-interval '10 days' WHERE event_id=$1", [outsiderEvent])
  await event(c,'c','link_click',outsider,randomUUID(),0)
  const stats = await db.rpc('analytics_summary', [c.user,7,null])
  expect(stats.uniqueVisitors).toBe(2)
  expect(stats.daily.reduce((sum,row) => sum + row.uniqueVisitors,0)).toBe(3)
  expect(stats).toMatchObject({ uniqueClickers: 1, uniqueCtr: 50, totalClicks: 2 })
})

test('clicks cannot invent links, views, publication revisions, or use disabled items', async () => {
  const c = await ready()
  const visit = randomUUID()
  expect(await event(c,'a','link_click',visit,randomUUID(),0)).toBe(false)
  await event(c,'a','profile_view',visit)
  expect(await event(c,'b','link_click',visit,randomUUID(),0)).toBe(false)
  expect(await event(c,'a','link_click',visit,randomUUID(),7)).toBe(false)
  expect(await event({ ...c, revision: 999 },'a')).toBe(false)
  await db.rpc('manage_nfc_item', [ids.admin,c.item.id,'deactivate',c.item.version,null,''])
  expect(await event(c,'a','link_click',visit,randomUUID(),0)).toBe(false)
})

test('browser identity deduplicates across the same owner items and history remains assignment-scoped after transfer', async () => {
  const c = await ready()
  const second = await db.item(c.user)
  await event(c)
  await event({ ...c, item: second })
  expect((await db.rpc('analytics_summary', [c.user,7,null]))).toMatchObject({ totalTaps: 2, uniqueVisitors: 1 })
  expect((await db.rpc('analytics_summary', [c.user,7,second.id]))).toMatchObject({ totalTaps: 1, uniqueVisitors: 1 })
  const next = await ready()
  await db.rpc('manage_nfc_item', [ids.admin,c.item.id,'transfer',c.item.version,next.user,''])
  await db.rpc('manage_nfc_item', [ids.admin,c.item.id,'activate',1,null,''])
  await event({ ...next, item: c.item })
  expect((await db.rpc('analytics_summary', [c.user,7,c.item.id]))).toMatchObject({ totalTaps: 1, uniqueVisitors: 1 })
  expect((await db.rpc('analytics_summary', [next.user,7,c.item.id]))).toMatchObject({ totalTaps: 1, uniqueVisitors: 1 })
  const hashes = (await db.pool.query('SELECT ip_hash FROM public.tap_events WHERE nfc_item_id=$1', [c.item.id])).rows.map(row => row.ip_hash)
  expect(hashes[0]).not.toBe(hashes[1])
})
