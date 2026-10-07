import { describe, expect, it } from 'vitest'
import { localDatabaseUrl } from './database-harness.js'

describe('database test connection guard', () => {
  it.each([
    undefined,
    'postgresql://postgres:password@remote.example/postgres',
    'postgresql://postgres:password@localhost.remote.example/postgres',
    'postgresql://postgres:password@localhost@remote.example/postgres',
    'postgresql://postgres:password@localhost/postgres?host=remote.example',
    'postgresql://postgres:password@localhost/postgres?hostaddr=192.0.2.1',
    'postgresql://postgres:password@localhost/postgres?options=foo',
    'https://localhost/postgres',
  ])('refuses unsafe connection %s before opening a database', value => {
    expect(() => localDatabaseUrl(value)).toThrow()
  })

  it.each(['localhost', '127.0.0.1', '[::1]'])('accepts loopback host %s', host => {
    expect(localDatabaseUrl(`postgresql://postgres:password@${host}:55439/postgres`).port).toBe('55439')
  })
})
