import config from '../vitest.config.mjs'

const integration = { ...config, test: { ...config.test, include: ['tests/database*.integration.test.js'], exclude: [], testTimeout: 15000 } }
export default integration
