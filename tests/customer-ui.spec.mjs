import { test, expect } from '@playwright/test'

test('latest draft is flushed before publish; later edits stay private and unpublish retains draft', async ({ page }) => {
  const account = { status: 'active', setup_completed_at: '2026-10-07T00:00:00Z', published_revision: null }
  let profile = { name: 'Original name', title: '', bio: '', links: [], show_save_contact: true, background: null, photo_asset_id: null, photo_url: null, revision: 0 }
  let publication = null
  const saved = []
  const published = []
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id: 'customer-1', email: 'customer@example.com' }, role: 'customer', account } }))
  await page.route('**/api/customer/profile', async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      saved.push(body)
      expect(body.expectedRevision).toBe(profile.revision)
      profile = { ...profile, ...body.draft, revision: profile.revision + 1 }
      return route.fulfill({ json: { profile } })
    }
    return route.fulfill({ json: { profile, account, publication, items: [{ id: 'item-1', slug: 'stable-card', is_active: true, url: 'https://beemhive.vercel.app/t/stable-card' }] } })
  })
  await page.route('**/api/customer/profile/publish', route => {
    if (route.request().method() === 'DELETE') { publication = null; account.published_revision = null; return route.fulfill({ json: { success: true } }) }
    const body = route.request().postDataJSON()
    published.push(body)
    expect(body.revision).toBe(profile.revision)
    publication = { revision: profile.revision, content: { ...profile }, published_at: '2026-10-07T12:00:00Z' }
    account.published_revision = profile.revision
    return route.fulfill({ json: { publication, account } })
  })
  await page.goto('/customer/profile')
  const name = page.getByLabel('Display name', { exact: true })
  await expect(name).toHaveValue('Original name')
  await name.fill('Latest complete name')
  await page.getByRole('button', { name: /^Publish/ }).first().click()
  await expect.poll(() => published.length).toBe(1)
  expect(saved.at(-1).draft.name).toBe('Latest complete name')
  expect(publication.content.name).toBe('Latest complete name')
  await name.fill('Private next revision')
  await page.getByRole('button', { name: 'Save private draft', exact: true }).click()
  await expect.poll(() => saved.length).toBe(2)
  expect(publication.content.name).toBe('Latest complete name')
  expect(published).toHaveLength(1)
  await page.getByRole('button', { name: 'Unpublish profile', exact: true }).click()
  await expect.poll(() => publication).toBeNull()
  await expect(name).toHaveValue('Private next revision')
})

test('setup-required customers can edit a draft but cannot publish', async ({ page }) => {
  const account = { status: 'active', setup_completed_at: null, published_revision: null }
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id: 'customer-1', email: 'customer@example.com' }, role: 'customer', account } }))
  await page.route('**/api/customer/profile', route => route.fulfill({ json: { profile: { name: 'Customer', links: [], revision: 0 }, account, publication: null, items: [] } }))
  await page.goto('/customer/profile')
  await expect(page.getByText('Complete account setup before publishing')).toBeVisible()
  await expect(page.getByLabel('Display name', { exact: true })).toBeEnabled()
  for (const button of await page.getByRole('button', { name: /^Publish/ }).all()) await expect(button).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Request setup email' })).toHaveAttribute('href', '/forgot-password')
})
