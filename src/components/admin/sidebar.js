'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { usePathname, useRouter } from 'next/navigation'
import { CreditCard, Users, BarChart2, ChevronLeft, ChevronRight, LogOut, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const NAV_ITEMS = [
  { label: 'NFC Items', icon: CreditCard, href: '/admin/nfc-items' },
  { label: 'Customers', icon: Users, href: '/admin/customers' },
  { label: 'Analytics', icon: BarChart2, href: '/admin/analytics' },
]

function NavItem({ item, isCollapsed, onClick }) {
  const pathname = usePathname()
  const isActive = pathname === item.href
  const Icon = item.icon

  const linkClass = `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
    ${isActive
      ? 'bg-amber-500 text-gray-900'
      : 'text-gray-400 hover:bg-white/10 hover:text-white'
    }
    ${isCollapsed ? 'justify-center px-2' : ''}
  `

  if (!isCollapsed) {
    return (
      <Link href={item.href} aria-current={isActive ? 'page' : undefined} onClick={onClick} className={linkClass}>
        <Icon size={18} className="shrink-0" />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link href={item.href} aria-label={item.label} title={item.label} aria-current={isActive ? 'page' : undefined} onClick={onClick} className={linkClass} />
        }
      >
        <Icon size={18} className="shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

export default function Sidebar({ isCollapsed, isMobileOpen, onToggleCollapse, onCloseMobile, userEmail, mobileTriggerRef }) {
  const router = useRouter()

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const closeOnDesktop = () => { if (media.matches && isMobileOpen) onCloseMobile() }
    media.addEventListener('change', closeOnDesktop)
    closeOnDesktop()
    return () => media.removeEventListener('change', closeOnDesktop)
  }, [isMobileOpen, onCloseMobile])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const userInitial = userEmail ? userEmail[0].toUpperCase() : '?'

  const avatarEl = (
    <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-gray-900 text-xs font-medium shrink-0">
      {userInitial}
    </div>
  )

  function sidebarContent(collapsed, mobile = false) {
    return (
    <div className={`flex flex-col h-full bg-[#111827] border-r border-white/10 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo + collapse toggle */}
      <div className={`flex items-center gap-3 px-3 py-4 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <Image src="/logo.png" alt="Beem Hive" width={24} height={24} className="shrink-0 rounded-sm" />
        {!collapsed && (
          <>
            <span className="text-white font-semibold text-sm flex-1">Beem Hive</span>
            <button
              type="button"
              onClick={mobile ? onCloseMobile : onToggleCollapse}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label={mobile ? 'Close navigation' : 'Collapse sidebar'}
              title={mobile ? 'Close navigation' : 'Collapse sidebar'}
            >
              {mobile ? <X size={16} /> : <ChevronLeft size={16} />}
            </button>
          </>
        )}
        {collapsed && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={onToggleCollapse}
                  type="button"
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                  className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                />
              }
            >
              <ChevronRight size={16} />
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Nav items */}
      <nav aria-label="Admin navigation" className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.href}
            item={item}
            isCollapsed={collapsed}
            onClick={onCloseMobile}
          />
        ))}
      </nav>

      {/* User info + sign out */}
      <div className={`flex items-center gap-2 px-3 py-3 border-t border-white/10 ${collapsed ? 'flex-col justify-center' : ''}`}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger render={<div className="cursor-default" />}>
              {avatarEl}
            </TooltipTrigger>
            <TooltipContent side="right">{userEmail}</TooltipContent>
          </Tooltip>
        ) : (
          <>
            {avatarEl}
            <span className="text-gray-400 text-xs truncate flex-1 min-w-0" title={userEmail}>
              {userEmail}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={handleSignOut}
                    type="button"
                    aria-label="Sign out"
                    title="Sign out"
                    className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  />
                }
              >
                <LogOut size={15} />
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </>
        )}
        {collapsed && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={handleSignOut}
                  type="button"
                  aria-label="Sign out"
                  title="Sign out"
                  className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                />
              }
            >
              <LogOut size={15} />
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen sticky top-0 shrink-0">
        {sidebarContent(isCollapsed)}
      </aside>

      {/* Mobile drawer */}
      <Dialog.Root open={isMobileOpen} onOpenChange={open => { if (!open) onCloseMobile() }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Popup finalFocus={mobileTriggerRef} className="fixed inset-y-0 left-0 z-50 h-dvh outline-none">
            <Dialog.Title className="sr-only">Admin navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Navigate between NFC items, customers and analytics.</Dialog.Description>
            {sidebarContent(false, true)}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
