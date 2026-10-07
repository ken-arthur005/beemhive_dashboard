import { expect, test } from 'vitest'
import { foldVcardLine, linkDestination, vcard } from '../src/lib/contact.js'

test('phone and email actions are native; unsafe website destinations fail closed', () => {
  expect(linkDestination({ type: 'phone', url: '+233 (24) 123-4567' })).toBe('tel:+233241234567')
  expect(linkDestination({ type: 'email', url: 'person@example.com' })).toBe('mailto:person@example.com')
  expect(linkDestination({ type: 'website', url: 'javascript:alert(1)' })).toBeNull()
  expect(linkDestination({ type: 'website', url: 'https://trusted.example@evil.example/' })).toBeNull()
})

test('vCard text is escaped, cannot inject properties, and Unicode folds without breaking UTF-8', () => {
  const name = 'Zoë; Smith, Junior\r\nX-EVIL:yes'
  const output = vcard({ name, title: 'Designer', bio: 'Line 1\nLine 2', links: [{ type: 'phone', url: '+233 123 456' }, { type: 'email', url: 'person@example.com' }] })
  expect(output).toContain('FN:Zoë\\; Smith\\, Junior\\nX-EVIL:yes')
  expect(output).not.toContain('\r\nX-EVIL:')
  expect(output).toContain('TEL;TYPE=CELL:+233123456')
  expect(output).toContain('EMAIL;TYPE=INTERNET:person@example.com')
  const folded = foldVcardLine(`FN:${'蜜'.repeat(80)}`)
  for (const row of folded.split('\r\n')) expect(new TextEncoder().encode(row).length).toBeLessThanOrEqual(75)
  expect(folded.replace(/\r\n /g, '')).toBe(`FN:${'蜜'.repeat(80)}`)
})
