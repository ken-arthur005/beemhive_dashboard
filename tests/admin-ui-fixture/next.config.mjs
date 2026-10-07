import { fileURLToPath } from 'node:url'

// Isolated UI harness: imports production admin components/layout while API
// responses are intercepted by Playwright. It never bypasses production auth.
const config = {
  images: { unoptimized: true },
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
  distDir: '.next-admin-ui',
}

export default config
