import { expect, test, vi } from 'vitest'
import { allRows, authDirectory } from '../src/lib/data.js'

test('table pagination advances by returned rows when an API cap is smaller than requested', async () => {
  const records = Array.from({ length: 123 }, (_, id) => ({ id }))
  const ranges = []
  const result = await allRows(() => ({ range: async (start, end) => {
    ranges.push([start, end])
    return { data: records.slice(start, start + 40), error: null }
  } }))
  expect(result).toEqual(records)
  expect(ranges.map(range => range[0])).toEqual([0, 40, 80, 120, 123])
})

test('Auth directory traverses clamped pages rather than treating a short page as completion', async () => {
  const users = Array.from({ length: 101 }, (_, id) => ({ id: String(id) }))
  const listUsers = vi.fn(async ({ page }) => ({ data: { users: users.slice((page - 1) * 50, page * 50) }, error: null }))
  expect(await authDirectory({ auth: { admin: { listUsers } } })).toEqual(users)
  expect(listUsers).toHaveBeenCalledTimes(4)
})
