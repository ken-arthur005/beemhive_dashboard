// Browser-safe: keep redirect input constrained to application destinations.
export function safeNext(value, fallback = '/customer/profile') {
  if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/') || value.startsWith('//')) return fallback
  if (/[\\\s%#]/.test(value)) return fallback
  try {
    const url = new URL(value, 'https://app.invalid')
    if (url.origin !== 'https://app.invalid' || url.pathname !== value.split('?')[0]) return fallback
    if (!['/admin', '/customer'].some(prefix => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) return fallback
    return `${url.pathname}${url.search}`
  } catch { return fallback }
}

export function roleDestination(role, next, { hasPublished = false } = {}) {
  const fallback = role === 'admin' ? '/admin/nfc-items' : hasPublished ? '/customer/overview' : '/customer/profile'
  const path = safeNext(next, fallback)
  const prefix = role === 'admin' ? '/admin' : '/customer'
  return path.split('?')[0] === prefix || path.startsWith(`${prefix}/`) ? path : fallback
}
