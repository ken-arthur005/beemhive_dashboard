'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { adminRequest } from '@/components/admin/admin-api'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/admin/admin-controls'
import { TooltipProvider } from '@/components/ui/tooltip'
import Sidebar from '@/components/admin/sidebar'
import Header from '@/components/admin/header'

export default function AdminLayout({ children }) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const mobileTriggerRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    adminRequest('/api/auth/session', { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return
      if (!data.user) {
        router.replace('/login')
        return
      }
      if (data.role !== 'admin') {
        router.replace('/customer/profile')
        return
      }
      try { setIsCollapsed(localStorage.getItem('beem_sidebar_collapsed') === 'true') } catch { /* Preferences are optional. */ }
      setUserEmail(data.user.email ?? '')
      setError('')
      setIsLoading(false)
    }).catch(error => {
      if (controller.signal.aborted) return
      if (error.status === 401) router.replace('/login')
      else { setError(error.message); setIsLoading(false) }
    })
    return () => controller.abort()
  }, [router, retry])

  function handleToggleCollapse() {
    setIsCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('beem_sidebar_collapsed', String(next)) } catch { /* Preferences are optional. */ }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <p role="status" className="text-sm text-gray-500">Checking admin access…</p>
      </div>
    )
  }

  if (error) return <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6"><Notice error={error} /><Button onClick={() => { setIsLoading(true); setError(''); setRetry(value => value + 1) }}>Retry admin access</Button></div>

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          onToggleCollapse={handleToggleCollapse}
          onCloseMobile={() => setIsMobileOpen(false)}
          userEmail={userEmail}
          mobileTriggerRef={mobileTriggerRef}
        />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Header
            onOpenMobile={() => setIsMobileOpen(true)}
            userEmail={userEmail}
            mobileTriggerRef={mobileTriggerRef}
            isMobileOpen={isMobileOpen}
          />
          <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
