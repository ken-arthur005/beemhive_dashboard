import { parsePhoneNumberFromString } from 'libphonenumber-js/max'

export const LINK_TYPES = [
  { value: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' },
  { value: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username', hosts: ['instagram.com'] },
  { value: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/username', hosts: ['x.com', 'twitter.com'] },
  { value: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username', hosts: ['linkedin.com'] },
  { value: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/233XXXXXXXXX', hosts: ['wa.me', 'whatsapp.com'] },
  { value: 'snapchat', label: 'Snapchat', placeholder: 'https://www.snapchat.com/add/username', hosts: ['snapchat.com'] },
  { value: 'phone', label: 'Phone', placeholder: 'Phone number' },
  { value: 'email', label: 'Email', placeholder: 'you@example.com' },
  { value: 'custom', label: 'Custom', placeholder: 'https://your-link.com' },
]

export function webUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null
  } catch { return null }
}

export function phoneNumber(value, country) {
  try { return parsePhoneNumberFromString(String(value).replace(/^tel:/i, ''), { defaultCountry: country, extract: false }) }
  catch { return undefined }
}

export function linkError(link) {
  const value = link.url?.trim()
  if (!value) return 'Enter a destination for this link.'
  if (link.type === 'phone') return phoneNumber(value, link.phone_country)?.isValid() ? null : 'Enter a valid phone number for the selected country, including its area code.'
  if (link.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.replace(/^mailto:/i, '')) ? null : 'Enter a valid email address.'
  const type = LINK_TYPES.find(type => type.value === link.type)
  const url = webUrl(value)
  if (!type || !url) return 'Enter a complete http:// or https:// URL.'
  if (type.hosts && !type.hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return `Use a ${type.label} URL.`
  return null
}

export function linkLabel(link) {
  return link.label?.trim() || (link.type === 'custom' ? webUrl(link.url)?.hostname.replace(/^www\./, '') || 'Custom link' : LINK_TYPES.find(type => type.value === link.type)?.label || 'Website')
}

export function normalizeDraftLinks(draft) {
  if (!Array.isArray(draft?.links)) return draft
  return { ...draft, links: draft.links.map(link => {
    if (!link || typeof link !== 'object' || link.type !== 'phone') return link
    const parsed = phoneNumber(link.url, link.phone_country)
    return parsed?.isValid() ? { ...link, url: parsed.number } : link
  }) }
}
