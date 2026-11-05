import { fileURLToPath } from 'node:url'

// Isolated UI harness: imports production admin components/layout while API
// responses are intercepted by Playwright. It never bypasses production auth.
const config = {
  images: { unoptimized: true },
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
  distDir: '.next-admin-ui',
  // Native browser Auth SDK tests are routed to a fake host, never the real project.
  env: { NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'ui-test-publishable-key' },
}

export default config
