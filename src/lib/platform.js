export function appOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL || 'https://beemhive.vercel.app'
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid application origin')
  return url.origin
}

export function itemUrl(slug) {
  return `${appOrigin()}/t/${encodeURIComponent(slug)}`
}
