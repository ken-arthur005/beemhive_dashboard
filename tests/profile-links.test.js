import { expect, test } from 'vitest'
import { LINK_TYPES, linkError, linkLabel, normalizeDraftLinks } from '../src/lib/profile-links'
import { linkDestination } from '../src/lib/contact'

test('validates country-aware numbers and normalizes saved numbers without discarding incomplete drafts', () => {
  const gh = { type: 'phone', url: '024 123 4567', phone_country: 'GH' }
  const us = { type: 'phone', url: '(202) 555-0123', phone_country: 'US' }
  expect(linkError(gh)).toBeNull()
  expect(linkError(us)).toBeNull()
  expect(linkDestination(gh)).toBe('tel:+233241234567')
  expect(normalizeDraftLinks({ links: [gh,us,{ type: 'phone', url: '+2' }] }).links.map(link => link.url)).toEqual(['+233241234567','+12025550123','+2'])
  expect(linkError({ type: 'phone', url: '123', phone_country: 'GH' })).toContain('valid phone number')
})

test('platform validation uses real hostnames rather than URL substrings', () => {
  expect(linkError({ type: 'snapchat', url: 'https://www.snapchat.com/add/person' })).toBeNull()
  expect(linkError({ type: 'instagram', url: 'https://instagram.com.evil.test/person' })).toBeTruthy()
  expect(linkError({ type: 'linkedin', url: 'https://evil.test/?next=linkedin.com' })).toBeTruthy()
  expect(linkError({ type: 'twitter', url: 'https://x.com@evil.test/person' })).toBeTruthy()
  expect(linkError({ type: 'custom', url: 'javascript:alert(1)' })).toBeTruthy()
})

test('custom links use the owner label or an identifiable hostname for legacy unnamed links', () => {
  expect(linkLabel({ type: 'custom', label: ' Book a session ', url: 'https://example.com' })).toBe('Book a session')
  expect(linkLabel({ type: 'custom', url: 'https://www.youtube.com/@creator' })).toBe('youtube.com')
  expect(linkLabel({ type: 'snapchat', url: 'https://snapchat.com/add/creator' })).toBe('Snapchat')
})

test('all 28 reference options and Custom are unique, grouped, valid and have destinations', () => {
  expect(LINK_TYPES).toHaveLength(29)
  expect(new Set(LINK_TYPES.map(type => type.value)).size).toBe(29)
  expect(LINK_TYPES.filter(type => type.value === 'whatsapp')).toHaveLength(1)
  for (const type of LINK_TYPES) {
    const url = type.value === 'phone' ? '+12025550123' : type.value === 'email' ? 'hello@example.com' : type.placeholder
    expect(linkError({ type: type.value, url }), type.label).toBeNull()
    expect(linkDestination({ type: type.value, url }), type.label).toBeTruthy()
    expect(type.group).toBeTruthy()
    if (type.hosts) expect(linkError({ type: type.value, url: `https://${type.hosts[0]}.evil.test/` }), type.label).toBeTruthy()
  }
})
