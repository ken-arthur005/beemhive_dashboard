import { test, expect } from '@playwright/test'

const profile = { name: 'Amara Mensah', title: 'Creative Director', bio: 'Making meaningful introductions.', links: [], show_save_contact: true, revision: 4, background: '#f7f6f2', photo_url: null }
const items = [{ id: 'card-1', slug: 'amara', product_type: 'card', is_active: true, url: 'https://app.test/t/amara' }]
async function customer(page, { hasPublished = true, published = true } = {}) {
  const account = { status: 'active', setup_completed_at: '2026-10-01T00:00:00Z', published_revision: published ? 4 : null }
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id: 'customer-1', email: 'amara@example.com' }, role: 'customer', account, hasPublished } }))
  await page.route('**/api/customer/profile', route => route.fulfill({ json: { profile, account, hasPublished, publication: published ? { revision: 4, content: profile } : null, items } }))
  await page.route('**/api/customer/analytics?*', route => route.fulfill({ json: { totalTaps: 248, todayTaps: 12, contactDownloads: 19, uniqueVisitors: 180, uniqueClickers: 45, uniqueCtr: 25, uniqueContactSavers: 18, contactConversionRate: 10, repeatVisitors: 20, trackedViews: 220, legacyViews: 28, totalClicks: 67, daily: [{ date: '2026-10-10', taps: 12, uniqueVisitors: 9 }, { date: '2026-10-11', taps: 19, uniqueVisitors: 12 }] } }))
  await page.route('**/api/customer/items', route => route.fulfill({ json: { items } }))
}

test('overview shows real metrics and preserves the explicit profile destination', async ({ page }) => {
  await customer(page)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/customer\/overview$/)
  await expect(page.getByRole('heading', { name: 'Welcome back, Amara.' })).toBeVisible()
  await expect(page.locator('dd').filter({ hasText: '248' })).toBeVisible()
  await expect(page.locator('dd').filter({ hasText: '19' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View profile', exact: true })).toHaveAttribute('href', 'https://app.test/t/amara')
  await page.goto('/customer')
  await expect(page).toHaveURL(/\/customer\/overview$/)
  await page.goto('/login?next=/customer/profile')
  await expect(page).toHaveURL(/\/customer\/profile$/)
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Amara Mensah')
})

test('never-published customers land on My Profile; unpublished returning customers land on Overview', async ({ page }) => {
  await customer(page, { hasPublished: false, published: false })
  await page.goto('/login')
  await expect(page).toHaveURL(/\/customer\/profile$/)
  await customer(page, { hasPublished: true, published: false })
  await page.goto('/login')
  await expect(page).toHaveURL(/\/customer\/overview$/)
  await expect(page.getByText('Private draft', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View profile', exact: true })).toHaveCount(0)
})

test('mobile overview has no page overflow and its navigation restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await customer(page)
  await page.goto('/customer/overview')
  await expect(page.getByRole('heading', { name: 'Welcome back, Amara.' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const opener = page.getByRole('button', { name: 'Open navigation' })
  await opener.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(opener).toBeFocused()
  await opener.click()
  await page.getByRole('dialog').getByRole('link', { name: 'My Cards', exact: true }).click()
  await expect(page).toHaveURL(/\/customer\/my-cards$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('theme switching stays coherent across customer navigation', async ({ page }) => {
  await customer(page)
  await page.goto('/customer/overview')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('navigation', { name: 'Customer navigation', exact: true }).getByRole('link', { name: 'My Profile', exact: true }).click()
  await expect(page.getByLabel('Display name', { exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('html')).toHaveClass(/light/)
})

test('sign-in stays immediately usable with reduced motion on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/auth/session', route => route.fulfill({ status: 401, json: { error: 'Please sign in' } }))
  await page.goto('/login')
  await expect(page.getByLabel('Email', { exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('public presentation preserves light and dark themes and contact/link destinations on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const theme of ['light','dark']) {
    await page.goto(`/public-profile-fixture?theme=${theme}`)
    await expect(page.getByRole('heading', { name: 'Amara Mensah' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explore my work' })).toHaveAttribute('href','https://example.com/')
    await expect(page.getByRole('link', { name: 'Save Contact' })).toHaveAttribute('href','/api/vcard?slug=fixture-profile')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('wide desktop shell fills the workspace and dark identity keeps its readable honey surface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await customer(page)
  for (const width of [1600,1920]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/customer/overview')
    await expect(page.getByRole('heading', { name: 'Welcome back, Amara.' })).toBeVisible()
    const box = await page.locator('.hive-shell').boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(Math.min(width - 36,1700) - 1)
  }
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  const colors = await page.locator('.hive-identity').evaluate(element => ({ background: getComputedStyle(element).backgroundImage, color: getComputedStyle(element).color }))
  expect(colors.background).toContain('248, 223, 135')
  expect(colors.color).toBe('rgb(48, 45, 30)')
})

test('public photo styles are real shapes and named custom links retain native destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const shape of ['arch','square','circle','rounded']) {
    await page.goto(`/public-profile-fixture?shape=${shape}`)
    const portrait = page.locator('.hive-public-portrait')
    await expect(portrait).toHaveAttribute('data-photo-shape',shape)
    const style = await portrait.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight, radius: getComputedStyle(element).borderRadius }))
    if (shape === 'circle' || shape === 'square') expect(style.width).toBe(style.height)
    if (shape === 'circle') expect(style.radius).toBe('50%')
    if (shape === 'square') expect(style.radius).toBe('0px')
    await expect(page.getByRole('link', { name: 'My channel' })).toHaveAttribute('href','https://youtube.com/@amara')
    await expect(page.getByRole('link', { name: 'Snapchat' })).toHaveAttribute('href','https://snapchat.com/add/amara')
  }
})

test('published tracking sends one view and attributes clicks without rewriting destinations', async ({ page }) => {
  const events = []
  await page.route('**/api/public/events', route => {
    events.push(route.request().postDataJSON())
    return route.fulfill({ json: { recorded: true } })
  })
  await page.goto('/public-profile-fixture?track=1')
  await expect.poll(() => events.length).toBe(1)
  await page.getByRole('link', { name: 'My channel' }).click({ modifiers: ['Control'] })
  await expect.poll(() => events.length).toBe(2)
  expect(events.map(event => event.type)).toEqual(['profile_view','link_click'])
  expect(events[1]).toMatchObject({ linkIndex: 2, visitId: events[0].visitId, revision: 4 })
  await page.goto('/public-profile-fixture')
  await expect(page.getByRole('heading', { name: 'Amara Mensah' })).toBeVisible()
  expect(events).toHaveLength(2)
})

test('analytics distinguishes total activity, unique reach, CTR and contact conversion', async ({ page }) => {
  await customer(page)
  await page.goto('/customer/analytics')
  const metrics = page.getByRole('region', { name: 'Reach & conversion' })
  await expect(metrics.locator('dd').filter({ hasText: /^180$/ })).toBeVisible()
  await expect(metrics.locator('dd').filter({ hasText: /^25%$/ })).toBeVisible()
  await expect(metrics.locator('dd').filter({ hasText: /^10%$/ })).toBeVisible()
  await expect(metrics.getByText(/67 total link clicks/)).toBeVisible()
  await metrics.getByText('How these metrics are counted').click()
  await expect(metrics.getByText(/28 older or unidentified visits/)).toBeVisible()
})
