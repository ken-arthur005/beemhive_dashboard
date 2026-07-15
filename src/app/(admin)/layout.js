'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import Sidebar from '@/components/admin/sidebar'
import Header from '@/components/admin/header'

export default function AdminLayout({ children }) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const collapsed = localStorage.getItem('beem_sidebar_collapsed')
    if (collapsed !== null) setIsCollapsed(collapsed === 'true')

    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }

      const { data: roleData } = await supabase
        .from('users_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      if (roleData?.role !== 'admin') {
        router.push('/customer/profile')
        return
      }

      setUserEmail(session.user.email ?? '')
      setIsLoading(false)
    }).catch(() => router.push('/login'))
  }, [])

  function handleToggleCollapse() {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem('beem_sidebar_collapsed', String(next))
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          onToggleCollapse={handleToggleCollapse}
          onCloseMobile={() => setIsMobileOpen(false)}
          userEmail={userEmail}
        />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Header
            onOpenMobile={() => setIsMobileOpen(true)}
            userEmail={userEmail}
          />
          <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
