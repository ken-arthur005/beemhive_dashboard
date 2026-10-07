export function linkDestination(link) {
  const value = String(link.url || '').trim()
  if (link.type === 'phone') return `tel:${value.replace(/^tel:/i, '').replace(/[ ()-]/g, '')}`
  if (link.type === 'email') return `mailto:${value.replace(/^mailto:/i, '')}`
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null }
  catch { return null }
}

function escapeText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

export function foldVcardLine(line) {
  const rows = []
  let row = ''
  let size = 0
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length
    if (size + bytes > 75) { rows.push(row); row = ' '; size = 1 }
    row += char
    size += bytes
  }
  rows.push(row)
  return rows.join('\r\n')
}

export function vcard(profile) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeText(profile.name)}`, `N:${escapeText(profile.name)};;;;`]
  if (profile.title) lines.push(`TITLE:${escapeText(profile.title)}`)
  if (profile.bio) lines.push(`NOTE:${escapeText(profile.bio)}`)
  for (const link of profile.links || []) {
    const destination = linkDestination(link)
    if (!destination) continue
    if (link.type === 'phone') lines.push(`TEL;TYPE=CELL:${destination.slice(4)}`)
    if (link.type === 'email') lines.push(`EMAIL;TYPE=INTERNET:${escapeText(destination.slice(7))}`)
    if (link.type === 'website') lines.push(`URL:${escapeText(destination)}`)
  }
  lines.push('END:VCARD')
  return lines.map(foldVcardLine).join('\r\n') + '\r\n'
}
