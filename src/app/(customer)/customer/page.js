'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomerProfile } from '@/components/customer/customer-profile-context'
import { roleDestination } from '@/lib/supabase/redirects'

export default function CustomerLanding() {
  const router = useRouter()
  const { hasPublished, account } = useCustomerProfile()
  const published = hasPublished || account?.published_revision != null
  useEffect(() => { router.replace(roleDestination('customer', null, { hasPublished: published })) }, [router, published])
  return <p role="status" className="text-sm text-muted-foreground">Opening your dashboard…</p>
}
