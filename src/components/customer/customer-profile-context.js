'use client'

import { createContext, useContext, useState } from 'react'

const CustomerProfileContext = createContext(null)

export async function customerRequest(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error((typeof data.error === 'string' ? data.error : data.error?.message) || data.message || 'The request failed. Please try again.')
    error.status = response.status
    error.code = data.code
    throw error
  }
  return data
}

export function CustomerProfileProvider({ initialData, userEmail, children }) {
  const [data, setData] = useState(initialData)
  const [isNavigationBlocked, setNavigationBlocked] = useState(false)
  function setProfile(value) {
    setData(previous => ({ ...previous, profile: typeof value === 'function' ? value(previous.profile) : value }))
  }
  function confirmNavigation() {
    return !isNavigationBlocked || window.confirm('Your latest changes are not saved. Leave this page and discard them?')
  }
  return (
    <CustomerProfileContext.Provider value={{ ...data, setData, setProfile, userEmail, setNavigationBlocked, confirmNavigation }}>
      {children}
    </CustomerProfileContext.Provider>
  )
}

export function useCustomerProfile() {
  const context = useContext(CustomerProfileContext)
  if (!context) throw new Error('useCustomerProfile must be used within CustomerProfileProvider')
  return context
}
