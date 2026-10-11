import { test, expect } from '@playwright/test'

const profile = { name: 'Amara Mensah', title: 'Creative Director', bio: 'Making meaningful introductions.', links: [], show_save_contact: true, revision: 4, background: '#f7f6f2', photo_url: null }
const items = [{ id: 'card-1', slug: 'amara', product_type: 'card', is_active: true, url: 'https://app.test/t/amara' }]
async function customer(page, { hasPublished = true, published = true } = {}) {
  const account = { status: 'active', setup_completed_at: '2026-10-01T00:00:00Z', published_revision: published ? 4 : null }
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id: 'customer-1', email: 'amara@example.com' }, role: 'customer', account, hasPublished } }))
  await page.route('**/api/customer/profile', route => route.fulfill({ json: { profile, account, hasPublished, publication: published ? { revision: 4, content: profile } : null, items } }))
  await page.route('**/api/customer/analytics?*', route => route.fulfill({ json: { totalTaps: 248, todayTaps: 12, contactDownloads: 19, daily: [{ date: '2026-10-10', taps: 12 }, { date: '2026-10-11', taps: 19 }] } }))
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
