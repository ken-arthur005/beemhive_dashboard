import { test, expect } from '@playwright/test'

const account = { status: 'active', setup_completed_at: '2026-10-01T00:00:00Z', published_revision: null }
const user = { id: '20000000-0000-0000-0000-000000000001', email: 'customer@example.test' }
function security(idleMs = 30*60_000) {
  const now = Date.now()
  return { valid: true, serverNow: new Date(now).toISOString(), idleExpiresAt: new Date(now+idleMs).toISOString(), expiresAt: new Date(now+8*3600_000).toISOString() }
}
async function profile(page) {
  await page.route('**/api/customer/profile', route => route.fulfill({ json: { profile: { name: 'Original customer', links: [], revision: 0 }, account, publication: null, items: [] } }))
}

test('every reference platform is selectable once, including creator and contact options', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user, role: 'customer', account } }))
  await profile(page)
  await page.goto('/customer/profile')
  await page.getByRole('button', { name: 'Add link', exact: true }).click()
  const picker = page.getByLabel('Link type', { exact: true })
  await expect(picker.locator('option')).toHaveCount(29)
  await expect(picker.locator('option[value="whatsapp"]')).toHaveCount(1)
  for (const type of ['facebook','tiktok','youtube','bluesky','pinterest','threads','reddit','telegram','messenger','discord','twitch','github','spotify','soundcloud','applemusic','googlemaps','googlereviews','googledrive','appstore','location']) {
    await picker.selectOption(type)
    await expect(picker).toHaveValue(type)
  }
})

test('expiry warning can extend inactivity through an explicit activity POST', async ({ page }) => {
  let touches = 0
  await page.route('**/api/auth/session', route => {
    if (route.request().method() === 'POST') { touches++; return route.fulfill({ json: { user, role: 'customer', session: security() } }) }
    return route.fulfill({ json: { user, role: 'customer', account, session: security(90_000) } })
  })
  await profile(page)
  await page.goto('/customer/profile')
  await expect(page.getByRole('status', { name: 'Session expiry warning' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay signed in' }).click()
  await expect.poll(() => touches).toBeGreaterThan(0)
  await expect(page.getByRole('status', { name: 'Session expiry warning' })).toHaveCount(0)
})

test('expired workspace retains unsaved edits, refuses another account, and resumes the same account', async ({ page }) => {
  let expired = false
  let resumed = false
  let wrongUser = false
  await page.route('**/api/auth/session', route => {
    if (expired && !resumed) return route.fulfill({ status: 401, json: { error: 'Session expired', code: 'session_expired' } })
    if (route.request().method() === 'POST') return route.fulfill({ json: { user, role: 'customer', session: security(3000) } })
    return route.fulfill({ json: { user: wrongUser ? { ...user,id: 'different-account' } : user, role: 'customer', account, session: security(resumed ? 30*60_000 : 3000) } })
  })
  await page.route('**/api/customer/profile', route => {
    if (route.request().method() === 'PUT' && expired) return route.fulfill({ status: 401,json: { error: 'Session expired',code: 'session_expired' } })
    return route.fulfill({ json: { profile: { name: 'Original customer',links: [],revision: 0 },account,publication: null,items: [] } })
  })
  await page.goto('/customer/profile')
  await page.getByLabel('Display name', { exact: true }).fill('Unsaved personal edit')
  expired = true
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Sign in in a new tab' })).toHaveAttribute('target','_blank')
  resumed = true
  wrongUser = true
  await dialog.getByRole('button', { name: 'I’ve signed in — resume' }).click()
  await expect(dialog.getByText('Sign back in with the same account', { exact: false })).toBeVisible()
  wrongUser = false
  await dialog.getByRole('button', { name: 'I’ve signed in — resume' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Unsaved personal edit')
})

async function nativeAuth(page, { enrolled = true } = {}) {
  const admin = { ...user,email: 'admin@example.test', aud: 'authenticated', role: 'authenticated', factors: enrolled ? [{ id: 'factor-1',factor_type: 'totp',status: 'verified',friendly_name: 'Admin phone' }] : [] }
  let verified = false
  let enrollments = 0
  const token = aal => [Buffer.from(JSON.stringify({ alg: 'HS256',typ: 'JWT' })).toString('base64url'),Buffer.from(JSON.stringify({ sub: user.id,aal,exp: Math.floor(Date.now()/1000)+3600,session_id: '30000000-0000-0000-0000-000000000001' })).toString('base64url'),'fixture-signature'].join('.')
  const authSession = () => ({ access_token: token(verified ? 'aal2' : 'aal1'),refresh_token: 'fixture-refresh',token_type: 'bearer',expires_in: 3600,expires_at: Math.floor(Date.now()/1000)+3600,user: admin })
  const cookie = `base64-${Buffer.from(JSON.stringify(authSession())).toString('base64url')}`
  await page.context().addCookies([{ name: 'sb-auth-auth-token',value: cookie,url: 'http://localhost:3107' }])
  await page.route('https://auth.example.test/auth/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    const headers = { 'Access-Control-Allow-Origin': '*','Access-Control-Allow-Headers': '*','Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200,headers })
    if (path.endsWith('/user')) return route.fulfill({ headers,json: admin })
    if (path.endsWith('/factors')) {
      enrollments++
      return route.fulfill({ headers,json: { id: 'factor-1',type: 'totp',totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50"/></svg>',secret: 'UI-FIXTURE-KEY',uri: 'otpauth://fixture' } } })
    }
    if (path.endsWith('/challenge')) return route.fulfill({ headers,json: { id: 'challenge-1',type: 'totp',expires_at: Math.floor(Date.now()/1000)+60 } })
    if (path.endsWith('/verify')) {
      const body = route.request().postDataJSON()
      if (body.code !== '123456') return route.fulfill({ status: 422,headers,json: { code: 'mfa_verification_failed',msg: 'Invalid code' } })
      verified = true
      return route.fulfill({ headers,json: authSession() })
    }
    return route.fulfill({ status: 400,headers,json: { msg: 'Unexpected fixture request' } })
  })
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: admin, role: 'admin',account: null,mfaRequired: !verified,session: security() } }))
  return { enrollments: () => enrollments }
}

test('first-factor admin is routed to MFA and wrong authenticator codes do not enter the workspace', async ({ page }) => {
  await nativeAuth(page)
  await page.goto('/login?next=/admin/customers')
  await expect(page).toHaveURL(/\/mfa\?next=/)
  await expect(page.getByLabel('Authenticator code')).toBeVisible()
  await page.getByLabel('Authenticator code').fill('000000')
  await page.getByRole('button', { name: 'Verify and continue' }).click()
  await expect(page.getByText('Verification failed.', { exact: false })).toBeVisible()
  await expect(page).toHaveURL(/\/mfa/)
  await page.getByLabel('Authenticator code').fill('123456')
  await page.getByRole('button', { name: 'Verify and continue' }).click()
  await expect(page).toHaveURL(/\/admin\/customers$/)
})

test('first admin enrollment is explicit and shows a QR, manual key, and backup guidance', async ({ page }) => {
  const fixture = await nativeAuth(page, { enrolled: false })
  await page.goto('/mfa')
  await expect(page.getByRole('button', { name: 'Set up authenticator' })).toBeVisible()
  expect(fixture.enrollments()).toBe(0)
  await page.getByRole('button', { name: 'Set up authenticator' }).click()
  await expect(page.getByRole('img', { name: 'Scan this QR code in your authenticator app' })).toBeVisible()
  await page.getByText('Can’t scan? Use the setup key').click()
  await expect(page.getByText('UI-FIXTURE-KEY')).toBeVisible()
  await expect(page.getByText('Before verifying, save the setup key', { exact: false })).toBeVisible()
  expect(fixture.enrollments()).toBe(1)
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('UI-FIXTURE-KEY')
})
