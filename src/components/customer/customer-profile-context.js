'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'

const CustomerProfileContext = createContext(null)

export function CustomerProfileProvider({ userId, userEmail, children }) {
  const [profile, setProfile] = useState({ name: null, photo_url: null })

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('name, photo_url')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data) setProfile({ name: data.name, photo_url: data.photo_url })
      })
  }, [userId])

  return (
    <CustomerProfileContext.Provider value={{ profile, setProfile, userEmail }}>
      {children}
    </CustomerProfileContext.Provider>
  )
}

export function useCustomerProfile() {
  const ctx = useContext(CustomerProfileContext)
  if (!ctx) throw new Error('useCustomerProfile must be used within CustomerProfileProvider')
  return ctx
}
