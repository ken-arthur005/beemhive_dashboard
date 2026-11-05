import { parsePhoneNumberFromString } from 'libphonenumber-js/max'

export const LINK_GROUPS = ['Social media', 'Professional & creator', 'Business & contact', 'Other']

export const LINK_TYPES = [
  { value: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username', hosts: ['instagram.com'] },
  { value: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  { value: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@username', hosts: ['tiktok.com'] },
  { value: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/username', hosts: ['x.com', 'twitter.com'] },
  { value: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel', hosts: ['youtube.com', 'youtu.be'] },
  { value: 'bluesky', label: 'Bluesky', placeholder: 'https://bsky.app/profile/yourhandle', hosts: ['bsky.app', 'bsky.social'] },
  { value: 'snapchat', label: 'Snapchat', placeholder: 'https://snapchat.com/add/username', hosts: ['snapchat.com'] },
  { value: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/username', hosts: ['pinterest.com', 'pin.it'] },
  { value: 'threads', label: 'Threads', placeholder: 'https://threads.com/@username', hosts: ['threads.com', 'threads.net'] },
  { value: 'reddit', label: 'Reddit', placeholder: 'https://reddit.com/user/username', hosts: ['reddit.com', 'redd.it'] },
  { value: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username', hosts: ['linkedin.com'] },
  { value: 'telegram', label: 'Telegram', placeholder: 'https://t.me/username', hosts: ['t.me', 'telegram.me'] },
  { value: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/233XXXXXXXXX', hosts: ['wa.me', 'whatsapp.com'] },
  { value: 'messenger', label: 'Facebook Messenger', placeholder: 'https://m.me/username', hosts: ['m.me', 'messenger.com', 'facebook.com'] },
  { value: 'discord', label: 'Discord', placeholder: 'https://discord.gg/invite', hosts: ['discord.gg', 'discord.com'] },
  { value: 'twitch', label: 'Twitch', placeholder: 'https://twitch.tv/username', hosts: ['twitch.tv'] },
  { value: 'github', label: 'GitHub', placeholder: 'https://github.com/username', hosts: ['github.com'] },
  { value: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/artist/your-id', hosts: ['spotify.com', 'spotify.link'] },
  { value: 'soundcloud', label: 'SoundCloud', placeholder: 'https://soundcloud.com/username', hosts: ['soundcloud.com'] },
  { value: 'applemusic', label: 'Apple Music', placeholder: 'https://music.apple.com/your-link', hosts: ['music.apple.com'] },
  { value: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' },
  { value: 'phone', label: 'Phone', placeholder: 'Phone number' },
  { value: 'email', label: 'Email', placeholder: 'you@example.com' },
  { value: 'googlemaps', label: 'Google Maps', placeholder: 'https://maps.app.goo.gl/your-place', hosts: ['google.com', 'maps.app.goo.gl', 'goo.gl', 'share.google'] },
  { value: 'googlereviews', label: 'Google Reviews', placeholder: 'https://g.page/r/your-business/review', hosts: ['g.page', 'google.com', 'maps.app.goo.gl', 'share.google'] },
  { value: 'googledrive', label: 'Google Drive', placeholder: 'https://drive.google.com/your-link', hosts: ['drive.google.com', 'docs.google.com'] },
  { value: 'appstore', label: 'App Store', placeholder: 'https://apps.apple.com/app/your-app', hosts: ['apps.apple.com', 'itunes.apple.com'] },
  { value: 'location', label: 'Location', placeholder: 'https://maps.apple.com/your-place' },
  { value: 'custom', label: 'Custom', placeholder: 'https://your-link.com' },
].map((type, index) => ({ ...type, group: LINK_GROUPS[index < 16 ? 0 : index < 20 ? 1 : index < 28 ? 2 : 3] }))

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
