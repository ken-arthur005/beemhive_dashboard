import { expect, test, vi } from 'vitest'
import { provisionVerifiedInvite } from '../src/lib/supabase/invitations.js'

function client(role = null) {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: role ? { role } : null, error: null }) }
  return { from: vi.fn(() => query), rpc: vi.fn(async () => ({ error: null })) }
}
test('verified membership always uses the nonprivileged customer RPC despite editable metadata', async () => {
  const db = client()
  await provisionVerifiedInvite(db, { id: 'verified-id', email: 'person@example.test', user_metadata: { role: 'admin', full_name: 'Customer name' } })
  expect(db.rpc).toHaveBeenCalledWith('ensure_customer', { p_user_id: 'verified-id', p_name: 'Customer name' })
  expect(db.rpc.mock.calls[0][1]).not.toHaveProperty('role')
})
test('verification preserves an existing admin role and does not create a customer profile', async () => {
  const db = client('admin')
  await provisionVerifiedInvite(db, { id: 'existing-admin' })
  expect(db.rpc).not.toHaveBeenCalled()
})
test('failed provisioning is reported honestly and never issues a completed membership', async () => {
  const db = client()
  db.rpc.mockResolvedValue({ error: { code: 'XX000' } })
  await expect(provisionVerifiedInvite(db, { id: 'verified-id', email: 'person@example.test' })).rejects.toMatchObject({ code: 'provisioning_retry', status: 503 })
})
