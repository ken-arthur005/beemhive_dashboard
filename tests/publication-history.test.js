import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { hasPublishedProfile } from '../src/lib/publication-history'

function auth(rows, error = null) {
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), limit: vi.fn(async () => ({ data: rows, error })) }
  return { role: 'customer', account: { published_revision: null }, user: { id: 'verified-customer' }, supabase: { from: vi.fn(() => query) }, query }
}
describe('durable publication-aware onboarding', () => {
  it('finds a historical snapshot even when the customer has unpublished', async () => {
    const context = auth([{ revision: 0 }])
    expect(await hasPublishedProfile(context)).toBe(true)
    expect(context.supabase.from).toHaveBeenCalledWith('profile_publications')
    expect(context.query.eq).toHaveBeenCalledWith('user_id', 'verified-customer')
    expect(context.query.limit).toHaveBeenCalledWith(1)
  })
  it('returns false for a customer who has never published', async () => {
    expect(await hasPublishedProfile(auth([]))).toBe(false)
  })
  it('recognizes revision zero as published without an extra history query', async () => {
    const context = auth([])
    context.account.published_revision = 0
    expect(await hasPublishedProfile(context)).toBe(true)
    expect(context.supabase.from).not.toHaveBeenCalled()
  })
  it('does not query history for admins or unprovisioned users', async () => {
    const context = auth([])
    expect(await hasPublishedProfile({ ...context, role: 'admin' })).toBe(false)
    expect(await hasPublishedProfile({ ...context, account: null })).toBe(false)
    expect(context.supabase.from).not.toHaveBeenCalled()
  })
  it('propagates a history failure rather than misclassifying a returning customer', async () => {
    await expect(hasPublishedProfile(auth(null, { code: '503' }))).rejects.toMatchObject({ code: '503' })
  })
})
