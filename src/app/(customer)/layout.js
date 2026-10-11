'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CustomerProfileProvider, customerRequest } from '@/components/customer/customer-profile-context'
import CustomerHeader from '@/components/customer/header'
import PageReveal from '@/components/shared/page-reveal'
import Brand from '@/components/shared/brand'

export default function CustomerLayout({ children }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [initialData, setInitialData] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      try {
        const session = await customerRequest('/api/auth/session', { signal: controller.signal })
        if (cancelled) return
        if (!session.user) { router.replace('/login'); return }
        if (session.role === 'admin') { router.replace('/admin/nfc-items'); return }
        if (session.role !== 'customer') throw new Error('This account does not have customer access.')
        if (session.account?.status !== 'active') throw new Error('Your account is currently unavailable. Contact Beem Hive for help.')
        const data = await customerRequest('/api/customer/profile', { signal: controller.signal })
        if (cancelled) return
        if (data.account?.status !== 'active') throw new Error('Your account is currently unavailable. Contact Beem Hive for help.')
        setInitialData(data)
        setUserEmail(session.user.email ?? '')
        setError(null)
      } catch (failure) {
        if (cancelled) return
        if (failure.status === 401) { router.replace('/login'); return }
        setError(failure.message)
      } finally { if (!cancelled) setIsLoading(false) }
    }
    load()
    return () => { cancelled = true; controller.abort() }
  }, [router, attempt])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col gap-5 items-center justify-center bg-background">
        <Brand /><p role="status" className="hive-eyebrow">Opening your hive…</p>
      </div>
    )
  }

  if (error) return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Customer access unavailable</h1>
      <p role="alert" className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
      <button className="rounded-lg bg-amber-500 px-4 py-2 text-gray-900" onClick={() => { setIsLoading(true); setAttempt(value => value + 1) }}>Try again</button>
      <a href="/login" className="text-sm underline">Back to login</a>
    </main>
  )

  return (
    <TooltipProvider>
      <CustomerProfileProvider initialData={initialData} userEmail={userEmail}>
        <div className="hive-shell">
          <CustomerHeader userEmail={userEmail} />
          <main id="main-content" className="hive-content"><PageReveal>{children}</PageReveal></main>
        </div>
      </CustomerProfileProvider>
    </TooltipProvider>
  )
}
