import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createHarness, ids } from './database-harness'
import { LINK_TYPES } from '../src/lib/profile-links'

let db
beforeAll(async () => { db = await createHarness(process.env.TEST_DATABASE_URL) }, 60000)
afterAll(async () => { if (db) await db.close() }, 30000)

test('all reference link types survive draft saving and immutable publication without weakening URL or count bounds', async () => {
  const c = await db.customer({ publish: false })
  let revision = c.revision
  for (const type of LINK_TYPES) {
    const url = type.value === 'phone' ? '+12025550123' : type.value === 'email' ? 'hello@example.com' : type.placeholder
    const draft = { ...c.draft, links: [{ id: type.value, type: type.value, url }] }
    const saved = await db.rpc('save_profile_draft', [c.user,revision,draft])
    revision = saved.revision
    expect(saved.links[0].type).toBe(type.value)
    expect((await db.rpc('publish_profile', [c.user,revision])).content.links[0]).toMatchObject({ type: type.value, url })
    await expect(db.rpc('save_profile_draft', [c.user,revision,{ ...draft, links: [{ type: type.value, url: 'javascript:alert(1)' }] }])).rejects.toMatchObject({ code: '22023' })
  }
  await expect(db.rpc('save_profile_draft', [c.user,revision,{ ...c.draft, links: [{ type: 'invented', url: 'https://example.com' }] }])).rejects.toMatchObject({ code: '22023' })
  await expect(db.rpc('save_profile_draft', [c.user,revision,{ ...c.draft, links: Array.from({ length: 9 }, () => ({ type: 'website', url: 'https://example.com' })) }])).rejects.toMatchObject({ code: '22023' })
})

test('session ID must exist in Auth and belong to the verified user', async () => {
  const c = await db.customer()
  expect(await db.rpc('check_app_session', [c.user,randomUUID(),true])).toEqual({ valid: false })
  const session = await db.session(c.user)
  expect(await db.rpc('check_app_session', [ids.admin,session,true])).toEqual({ valid: false })
  await db.pool.query('DELETE FROM auth.sessions WHERE id=$1', [session])
  expect(await db.rpc('check_app_session', [c.user,session,false])).toEqual({ valid: false })
})

test('role-specific absolute and idle deadlines derive from the real Auth sign-in, not JWT refresh or first API visit', async () => {
  const c = await db.customer()
  for (const [user,idleMinutes,maxHours] of [[ids.admin,30,8],[c.user,24*60,7*24]]) {
    const start = new Date(Date.now()-60_000)
    const session = await db.session(user,start)
    const checked = await db.rpc('check_app_session', [user,session,false])
    expect(checked.valid).toBe(true)
    expect(Date.parse(checked.expiresAt)-start.getTime()).toBe(maxHours*3600_000)
    expect(Date.parse(checked.idleExpiresAt)-start.getTime()).toBe(idleMinutes*60_000)
    const touched = await db.rpc('check_app_session', [user,session,true])
    expect(Date.parse(touched.idleExpiresAt)).toBeGreaterThan(Date.parse(checked.idleExpiresAt))
    expect(touched.expiresAt).toBe(checked.expiresAt)
  }
  const old = await db.session(ids.admin,new Date(Date.now()-9*3600_000))
  expect(await db.rpc('check_app_session', [ids.admin,old,true])).toEqual({ valid: false })
})

test('polling never extends inactivity, and expired sessions cannot revive under concurrent touches', async () => {
  const session = await db.session(ids.admin)
  const original = await db.rpc('check_app_session', [ids.admin,session,false])
  const polled = await db.rpc('check_app_session', [ids.admin,session,false])
  expect(polled.idleExpiresAt).toBe(original.idleExpiresAt)
  await db.pool.query("UPDATE public.app_sessions SET started_at=now()-interval '1 hour',last_activity_at=now()-interval '30 minutes' WHERE session_id=$1", [session])
  const attempts = await Promise.all(Array.from({ length: 8 }, () => db.rpc('check_app_session', [ids.admin,session,true])))
  expect(attempts.every(result => result.valid === false)).toBe(true)
  // Even another valid JWT for the same session cannot undo its durable expiry.
  await db.pool.query('UPDATE public.app_sessions SET last_activity_at=now() WHERE session_id=$1', [session])
  expect(await db.rpc('check_app_session', [ids.admin,session,true])).toEqual({ valid: false })
})

test('maximum lifetime still expires during recent activity', async () => {
  const c = await db.customer()
  for (const [user,age] of [[ids.admin,'8 hours'],[c.user,'7 days']]) {
    const session = await db.session(user)
    await db.pool.query(`UPDATE public.app_sessions SET started_at=now()-$2::interval,last_activity_at=now() WHERE session_id=$1`, [session,age])
    expect(await db.rpc('check_app_session', [user,session,true])).toEqual({ valid: false })
  }
})

test('a request waiting on a row lock cannot use a stale pre-expiry clock', async () => {
  const session = await db.session(ids.admin)
  const blocker = await db.pool.connect()
  let attempt
  try {
    await blocker.query('BEGIN')
    await blocker.query("UPDATE public.app_sessions SET started_at=now()-interval '1 hour',last_activity_at=clock_timestamp()-interval '29 minutes 59.8 seconds' WHERE session_id=$1", [session])
    attempt = db.rpc('check_app_session', [ids.admin,session,true])
    await blocker.query('SELECT pg_sleep(0.4)')
    await blocker.query('COMMIT')
    expect(await attempt).toEqual({ valid: false })
  } finally {
    await blocker.query('ROLLBACK')
    blocker.release()
    if (attempt) await attempt.catch(() => {})
  }
})

test('direct Data API reads require a live app session and administrator AAL2; public profile resolution is unaffected', async () => {
  const session = await db.session(ids.admin)
  const read = (claims = {}) => db.asRole('authenticated',ids.admin,'SELECT * FROM public.profiles',[],{ session_id: session,...claims })
  expect((await read({ aal: 'aal1' })).rowCount).toBe(0)
  expect((await read({ aal: 'aal2' })).rowCount).toBeGreaterThan(0)
  expect((await read({ session_id: randomUUID() })).rowCount).toBe(0)
  await db.pool.query("UPDATE public.app_sessions SET started_at=now()-interval '1 hour',last_activity_at=now()-interval '31 minutes' WHERE session_id=$1", [session])
  expect((await read()).rowCount).toBe(0)
  const c = await db.customer()
  const item = await db.item(c.user)
  expect((await db.rpc('resolve_public_profile', [item.slug])).content.name).toBe(c.draft.name)
  for (const role of ['anon','authenticated']) {
    await expect(db.asRole(role,c.user,'SELECT * FROM public.app_sessions')).rejects.toMatchObject({ code: '42501' })
    await expect(db.asRole(role,c.user,'SELECT public.check_app_session($1,$2,true)',[c.user,session])).rejects.toMatchObject({ code: '42501' })
  }
})
