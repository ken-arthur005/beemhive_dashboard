import { createBrowserClient } from '@supabase/ssr'
import { publicKey } from './config'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey()
  )
}

// Layouts use this verified endpoint rather than trusting getSession().user.
export async function getAuthSession({ signal } = {}) {
  const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin', signal })
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(data.error || 'Unable to check your account. Please try again.')
    error.code = data.code
    error.status = response.status
    throw error
  }
  return data
}
