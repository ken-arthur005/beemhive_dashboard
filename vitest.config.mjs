import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), 'server-only': fileURLToPath(new URL('./tests/server-only.mjs', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.js'], exclude: ['tests/database*.integration.test.js'], clearMocks: true, fileParallelism: false },
})
