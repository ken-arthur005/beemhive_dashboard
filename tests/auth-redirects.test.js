import { describe, expect, it } from 'vitest'
import { safeNext, roleDestination } from '../src/lib/supabase/redirects'

describe('safe callback destinations', () => {
  it.each([
    null, '', 'https://evil.test', '//evil.test/customer', '/\\evil.test', '/customer/../auth/confirm',
    '/customer/%2e%2e/auth', '/%2f%2fevil.test', '/customer\nX-header: injected', '/customer#fragment',
    '/auth/confirm?type=invite', '/invite', '/customerish', '/admin/../../evil', '/customer/./profile',
  ])('rejects unsafe or non-dashboard next %s', input => {
    expect(safeNext(input, '/customer/profile')).toBe('/customer/profile')
  })
  it('accepts local dashboard paths including query strings', () => {
    expect(safeNext('/customer/items?page=2')).toBe('/customer/items?page=2')
    expect(safeNext('/admin/nfc-items')).toBe('/admin/nfc-items')
  })
  it('keeps exact roles in their own dashboard', () => {
    expect(roleDestination('admin', '/customer/profile')).toBe('/admin/nfc-items')
    expect(roleDestination('customer', '/admin/customers')).toBe('/customer/profile')
  })
  it('lands customers on their profile until first publish and on overview afterward', () => {
    expect(roleDestination('customer', null, { hasPublished: false })).toBe('/customer/profile')
    expect(roleDestination('customer', null, { hasPublished: true })).toBe('/customer/overview')
    expect(roleDestination('customer', '//evil.test', { hasPublished: true })).toBe('/customer/overview')
    expect(roleDestination('admin', null, { hasPublished: true })).toBe('/admin/nfc-items')
  })
  it('preserves explicitly requested customer pages after first publication', () => {
    expect(roleDestination('customer', '/customer/profile', { hasPublished: true })).toBe('/customer/profile')
    expect(roleDestination('customer', '/customer/analytics?days=30', { hasPublished: true })).toBe('/customer/analytics?days=30')
  })
})
