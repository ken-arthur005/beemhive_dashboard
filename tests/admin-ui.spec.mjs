import { test, expect } from '@playwright/test'

const item = { id: 'item-1', slug: 'stable-card', product_type: 'card', owner_id: 'customer-1', ownerEmail: 'ada@example.com', is_active: false, version: 7, tapCount: 52, created_at: '2026-01-01T00:00:00Z' }
const customer = { user_id: 'customer-1', name: 'Ada', email: 'ada@example.com', status: 'active', setup_completed_at: null, published_revision: null, nfc_items: [item], nfc_item_count: 1 }
const options = [customer, { user_id: 'customer-2', name: 'Kojo', email: 'kojo@example.com' }]
const analytics = { totalTaps: 1234, todayCount: 89, contactDownloads: 37, current: { totalTaps: 1234 }, previous: { totalTaps: 1000 }, totalCustomers: 43, totalItems: 68, deviceTotals: { mobile: 900, desktop: 334 }, daily: [{ date: '2026-10-07', taps: 1234 }], hourly: [{ hour: 12, taps: 100 }], leaderboard: [{ ...item, tap_count: 1234 }], recentActivity: [{ id: 'tap-1', slug: item.slug, device_type: 'mobile', event_type: 'profile_view', created_at: '2026-10-07T12:00:00Z', owner_email: customer.email }] }
const respond = (route, data, status = 200) => route.fulfill({ status, json: data })

test.beforeEach(async ({ page }) => {
  await page.route('**/logo.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=', 'base64') }))
  await page.route('**/api/auth/session', route => respond(route, { user: { id: 'admin-1', email: 'admin@example.com' }, role: 'admin', account: null }))
  await page.route('**/api/admin/nfc-items?*', route => respond(route, { items: [item], total: 21, page: Number(new URL(route.request().url()).searchParams.get('page')), pageSize: 10 }))
  await page.route('**/api/admin/customers?*', route => respond(route, { customers: [customer], total: 1, page: 1, pageSize: 10 }))
  await page.route('**/api/admin/customer-options?*', route => respond(route, { customers: options }))
  await page.route('**/api/admin/analytics?*', route => respond(route, analytics))
  await page.route('**/api/admin/deletions', route => respond(route, { jobs: [] }))
})

test('server pagination, filters and load retry use API metadata', async ({ page }) => {
  let fail = true
  const queries = []
  await page.route('**/api/admin/nfc-items?*', route => {
    const query = new URL(route.request().url()).searchParams
    queries.push(Object.fromEntries(query))
    return fail ? respond(route, { error: 'Directory unavailable' }, 503) : respond(route, { items: [{ ...item, slug: `page-${query.get('page')}` }], total: 21, page: Number(query.get('page')), pageSize: 10 })
  })
  await page.goto('/admin/nfc-items')
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Directory unavailable')
  fail = false
  await page.getByRole('button', { name: 'Retry loading items' }).click()
  await expect(page.getByText('Page 1 of 3 · 21 results')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('page-2', { exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search NFC items' }).fill('Kojo')
  await expect.poll(() => queries.at(-1)).toMatchObject({ page: '1', search: 'Kojo' })
  await page.getByLabel('Product type filter').selectOption('stand')
  await page.getByLabel('Item status filter').selectOption('retired')
  await expect.poll(() => queries.at(-1)).toMatchObject({ type: 'stand', status: 'retired', search: 'Kojo', page: '1' })
})

test('existing-customer creation reuses durable operation after lost response and reload', async ({ page }) => {
  const bodies = []
  await page.route('**/api/admin/nfc-items', route => {
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1 ? route.abort('failed') : respond(route, { item: { ...item, slug: bodies.at(-1).slug } })
  })
  await page.goto('/admin/nfc-items')
  await page.getByRole('button', { name: 'Create NFC Item' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Search existing customers').fill('Kojo')
  await expect.poll(() => page.getByLabel('Existing customer', { exact: true }).isEnabled()).toBe(true)
  await dialog.getByLabel('Existing customer', { exact: true }).selectOption('customer-2')
  await dialog.getByLabel('Slug', { exact: true }).fill('kojo-card')
  await dialog.getByRole('button', { name: 'Create item', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('may have completed')
  expect(bodies[0]).toMatchObject({ ownerId: 'customer-2', slug: 'kojo-card', productType: 'card' })
  expect(bodies[0].operationKey).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/)
  await page.reload()
  await page.getByRole('button', { name: 'Create NFC Item' }).click()
  await page.getByRole('button', { name: 'Retry creation' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'NFC item created' })).toBeVisible()
  expect(bodies[1]).toEqual(bodies[0])
  await expect(page.getByRole('dialog').getByText('https://beemhive.vercel.app/t/kojo-card', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('beem_admin_pending_creation_v1'))).toBeNull()
})

test('invitation retry preserves provisioned operation and does not claim email delivery', async ({ page }) => {
  const bodies = []
  await page.route('**/api/invite', route => {
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1 ? respond(route, { error: 'User provisioned; email delivery failed', code: 'invite_failed' }, 502) : respond(route, { item: { ...item, slug: 'new-card' }, operationId: bodies[0].operationKey })
  })
  await page.goto('/admin/nfc-items')
  await page.getByRole('button', { name: 'Create NFC Item' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Customer assignment').selectOption('invite')
  await dialog.getByLabel('Customer name').fill('New Customer')
  await dialog.getByLabel('Email', { exact: true }).fill('new@example.com')
  await dialog.getByLabel('Confirm email').fill('new@example.com')
  await dialog.getByLabel('Slug', { exact: true }).fill('new-card')
  await dialog.getByRole('button', { name: 'Create item', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('User provisioned; email delivery failed')
  await expect(dialog.getByLabel('Email', { exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Retry creation' }).click()
  await expect(dialog.getByRole('heading', { name: 'NFC item created' })).toBeVisible()
  expect(bodies[1]).toEqual(bodies[0])
  expect(bodies[0]).toMatchObject({ email: 'new@example.com', customerName: 'New Customer', slug: 'new-card', productType: 'card' })
  await expect(dialog).not.toContainText('Invite sent')
})

test('transfer sends expected version, target and reason and leaves URL stable', async ({ page }) => {
  const bodies = []
  await page.route('**/api/admin/nfc-items/item-1', route => {
    expect(route.request().method()).toBe('PATCH')
    bodies.push(route.request().postDataJSON())
    return respond(route, { item: { ...item, owner_id: 'customer-2', is_active: false, version: 8 } })
  })
  await page.goto('/admin/nfc-items')
  await page.getByRole('button', { name: `Actions for ${item.slug}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Transfer ownership' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Existing customer', { exact: true }).selectOption('customer-2')
  await dialog.getByLabel('Reason (optional)').fill('Replacement assignment')
  await dialog.getByRole('button', { name: 'Transfer and pause' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Ownership transferred' })).toBeVisible()
  expect(bodies).toEqual([{ action: 'transfer', version: 7, targetOwnerId: 'customer-2', reason: 'Replacement assignment' }])
  await expect(page.getByText('stable-card', { exact: true })).toBeVisible()
})

test('activation eligibility and version conflicts remain visible without optimistic success', async ({ page }) => {
  let conflict = false
  await page.route('**/api/admin/nfc-items/item-1', route => respond(route, { error: conflict ? 'Version conflict' : 'Owner must complete setup and publish' }, conflict ? 409 : 422))
  await page.goto('/admin/nfc-items')
  await page.getByRole('switch', { name: 'Activate stable-card' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Owner must complete setup and publish')
  await expect(page.getByRole('switch', { name: 'Activate stable-card', includeHidden: true })).not.toBeChecked()
  conflict = true
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('review the latest item')
})

test('retirement uses PATCH rather than raw deletion and confirms preservation', async ({ page }) => {
  let request
  await page.route('**/api/admin/nfc-items/item-1', route => {
    request = { method: route.request().method(), body: route.request().postDataJSON() }
    return respond(route, { item: { ...item, retired_at: '2026-10-07T00:00:00Z', version: 8 } })
  })
  await page.goto('/admin/nfc-items')
  await page.getByRole('button', { name: 'Actions for stable-card' }).click()
  await page.getByRole('menuitem', { name: 'Retire item', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('physical URL and tap history are preserved')
  await page.getByRole('dialog').getByRole('button', { name: 'Retire item', exact: true }).click()
  await expect.poll(() => request).toEqual({ method: 'PATCH', body: { action: 'retire', version: 7, reason: '' } })
})

test('customer status, publication, pagination and invitation resend are independent', async ({ page }) => {
  const rows = [customer, { ...customer, user_id: 'customer-2', email: 'draft@example.com', status: 'suspended', setup_completed_at: '2026-01-01', published_revision: null }, { ...customer, user_id: 'customer-3', email: 'published@example.com', status: 'suspended', setup_completed_at: '2026-01-01', published_revision: 0 }]
  const queries = []
  let resend
  await page.route('**/api/admin/customers?*', route => {
    const query = new URL(route.request().url()).searchParams
    queries.push(Object.fromEntries(query))
    return respond(route, { customers: rows, total: 33, page: Number(query.get('page')), pageSize: 10 })
  })
  await page.route('**/api/invite', route => { resend = route.request().postDataJSON(); return respond(route, { success: true }) })
  await page.goto('/admin/customers')
  await expect(page.getByText('Setup required', { exact: true })).toBeVisible()
  await expect(page.getByText('Draft', { exact: true })).toBeVisible()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  await expect(page.getByRole('table').getByText('Suspended', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Page 2 of 4 · 33 results')).toBeVisible()
  await page.getByLabel('Sort customers').selectOption('name')
  await page.getByLabel('Account status filter').selectOption('suspended')
  await expect.poll(() => queries.at(-1)).toMatchObject({ page: '1', sort: 'name', status: 'suspended' })
  await page.getByRole('button', { name: 'Actions for ada@example.com', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Resend setup invitation' }).click()
  await expect.poll(() => resend).toEqual({ mode: 'resend', userId: 'customer-1' })
  await page.getByRole('button', { name: 'Ada ada@example.com' }).click()
  await expect(page.getByText('Publication: Unpublished draft', { exact: false })).toBeVisible()
})

test('suspension and reinstatement use explicit account PATCH', async ({ page }) => {
  let suspended = false
  const requests = []
  await page.route('**/api/admin/customers?*', route => respond(route, { customers: [{ ...customer, status: suspended ? 'suspended' : 'active' }], total: 1, page: 1, pageSize: 10 }))
  await page.route('**/api/admin/customers/customer-1', route => {
    expect(route.request().method()).toBe('PATCH')
    requests.push(route.request().postDataJSON())
    suspended = requests.at(-1).status === 'suspended'
    return respond(route, { account: { status: requests.at(-1).status } })
  })
  await page.goto('/admin/customers')
  await page.getByRole('button', { name: 'Actions for ada@example.com' }).click()
  await page.getByRole('menuitem', { name: 'Suspend customer' }).click()
  await page.getByRole('dialog').getByLabel('Reason (optional)').fill('Requested pause')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('table').getByText('Suspended', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Actions for ada@example.com' }).click()
  await page.getByRole('menuitem', { name: 'Reinstate customer' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('table').getByText('Active', { exact: true })).toBeVisible()
  expect(requests).toEqual([{ status: 'suspended', reason: 'Requested pause' }, { status: 'active', reason: '' }])
})

test('permanent deletion requires native email confirmation and retries unfinished cleanup honestly', async ({ page }) => {
  const requests = []
  await page.route('**/api/admin/customers/customer-1', route => {
    requests.push({ method: route.request().method(), body: route.request().postDataJSON() })
    if (requests.length === 1) return respond(route, { error: 'Storage cleanup failed', jobId: 'job-123', status: 'storage_pending' }, 503)
    if (requests.length === 2) return respond(route, { success: false, jobId: 'job-123', status: 'auth_pending' }, 202)
    return respond(route, { success: true, jobId: 'job-123' })
  })
  await page.goto('/admin/customers')
  await page.getByRole('button', { name: 'Actions for ada@example.com' }).click()
  await page.getByRole('menuitem', { name: 'Permanently delete customer' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('physical URLs and anonymized tap history are preserved')
  await expect(dialog.getByRole('button', { name: 'Permanently delete', exact: true })).toBeDisabled()
  await expect(dialog.getByLabel('Confirm customer email')).toHaveAttribute('type', 'email')
  await dialog.getByLabel('Confirm customer email').fill('wrong@example.com')
  await expect(dialog.getByRole('button', { name: 'Permanently delete', exact: true })).toBeDisabled()
  await dialog.getByLabel('Confirm customer email').fill(customer.email)
  await dialog.getByRole('button', { name: 'Permanently delete', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Cleanup is not confirmed complete')
  await expect(dialog).toContainText('job-123: storage_pending')
  await expect(page.getByRole('status').filter({ hasText: 'Customer cleanup completed' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Retry cleanup' }).click()
  await expect(dialog).toContainText('job-123: auth_pending')
  await expect(dialog.getByRole('alert')).toContainText('Cleanup is not confirmed complete')
  await dialog.getByRole('button', { name: 'Retry cleanup' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Customer cleanup completed (job job-123)' })).toBeVisible()
  expect(requests).toEqual(Array.from({ length: 3 }, () => ({ method: 'DELETE', body: { confirmEmail: customer.email } })))
})

test('analytics use aggregate counts, range queries and error retry instead of raw events', async ({ page }) => {
  const queries = []
  let fail = false
  await page.route('**/api/admin/analytics?*', route => {
    const days = new URL(route.request().url()).searchParams.get('days')
    queries.push(days)
    return fail ? respond(route, { error: 'Analytics unavailable' }, 503) : respond(route, { ...analytics, totalTaps: days === '30' ? 2345 : 1234 })
  })
  await page.goto('/admin/analytics')
  await expect(page.getByText('1,234', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('37', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '30D', exact: true }).click()
  await expect(page.getByText('2,345', { exact: true })).toBeVisible()
  expect(queries).toContain('30')
  await expect(page.getByText('Last 30 days', { exact: true })).toBeVisible()
  fail = true
  await page.getByRole('button', { name: '90D', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Analytics unavailable')
  await expect(page.getByText('2,345', { exact: true })).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Retry analytics' }).click()
  await expect(page.getByText('1,234', { exact: true }).first()).toBeVisible()
})

test('mobile drawer traps keyboard focus, closes on Escape and restores opener', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/nfc-items')
  const opener = page.getByRole('button', { name: 'Open navigation' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog', { name: 'Admin navigation' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Close navigation' })).toBeFocused()
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab')
    await expect.poll(() => drawer.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await expect(opener).toBeFocused()
  await opener.click()
  await drawer.getByRole('link', { name: 'Customers', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/customers$/)
  await expect(drawer).not.toBeVisible()
  await expect(opener).toBeFocused()
})

test('QR downloads report API errors and download the authenticated PNG only', async ({ page }) => {
  let fail = true
  let requestedSlug
  await page.route('**/api/qr?*', route => {
    requestedSlug = new URL(route.request().url()).searchParams.get('slug')
    return fail ? respond(route, { error: 'QR service unavailable' }, 503) : route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=', 'base64') })
  })
  await page.goto('/admin/nfc-items')
  await page.getByRole('button', { name: 'Actions for stable-card' }).click()
  await page.getByRole('menuitem', { name: 'Download QR (may be inactive/unpublished)', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('QR service unavailable')
  fail = false
  await page.getByRole('button', { name: 'Actions for stable-card' }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Download QR (may be inactive/unpublished)', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('stable-card-qr.png')
  expect(requestedSlug).toBe('stable-card')
  await expect(page.getByRole('status').filter({ hasText: 'A QR code does not make an inactive or unpublished profile public' })).toBeVisible()
})

test('clipboard failure does not announce successful copy', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Permission denied') } }, configurable: true })
  })
  await page.goto('/admin/nfc-items')
  await page.getByRole('button', { name: 'Copy canonical URL for stable-card' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Could not copy. Copy this URL manually: https://beemhive.vercel.app/t/stable-card')
  await expect(page.getByRole('status').filter({ hasText: 'Canonical URL copied' })).toHaveCount(0)
})
