import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  testDir: '.',
  testMatch: ['admin-ui.spec.mjs', 'customer-ui.spec.mjs'],
  outputDir: './admin-ui-results',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://localhost:3107', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true },
  webServer: {
    command: 'pnpm exec next dev tests/admin-ui-fixture --port 3107',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: 'http://localhost:3107/admin/nfc-items',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
