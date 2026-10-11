import { test, expect } from '@playwright/test'

test('native email confirmation POST keeps a real Origin and redirects to a GET password page', async ({ page }) => {
  const posts = []
  const destinationMethods = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/invite') destinationMethods.push(request.method())
  })
  await page.route('**/auth/confirm?*', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    posts.push({ method: route.request().method(), origin: route.request().headers().origin, referer: route.request().headers().referer })
    // Only the Auth result is intercepted. The GET HTML, CSP and Referrer-Policy
    // are the production handler, and browser-native headers are not fabricated.
    return route.fulfill({ status: 303, headers: { Location: '/invite' }, body: '' })
  })
  const response = await page.goto('/auth/confirm?token_hash=browser-regression&type=invite')
  expect(response.headers()['referrer-policy']).toBe('strict-origin')
  expect(posts).toHaveLength(0)
  await page.getByRole('button', { name: 'Continue to password setup' }).click()
  await expect(page.getByRole('heading', { name: 'Password setup page' })).toBeVisible()
  expect(posts).toHaveLength(1)
  expect(posts[0].origin).toBe('http://localhost:3107')
  expect(posts[0].referer).not.toContain('token_hash')
  expect(destinationMethods).toEqual(['GET'])
})
