'use client'

import Brand from '@/components/shared/brand'
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

  const linkClass = `hive-admin-sidebar-nav
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
    <div className="hive-avatar shrink-0">
      {userInitial}
    </div>
  )

  function sidebarContent(collapsed, mobile = false) {
    return (
    <div data-collapsed={collapsed} className={`hive-admin-sidebar flex flex-col h-full ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo + collapse toggle */}
      <div className={`flex items-center gap-2 px-5 py-7 ${collapsed ? 'justify-center flex-col' : ''}`}>
        <Brand compact={collapsed} />
        {!collapsed && (
          <>
            <button
              type="button"
              onClick={mobile ? onCloseMobile : onToggleCollapse}
              className="ml-auto p-1 text-muted-foreground hover:text-foreground"
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
                  className="p-1 text-muted-foreground hover:text-foreground"
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
      {!collapsed && <p className="hive-eyebrow px-8 pt-5 pb-4">Your workspace</p>}
      <nav aria-label="Admin navigation" className="flex-1 flex flex-col gap-2 p-4 overflow-y-auto">
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
      {!collapsed && <div className="mx-6 mb-6 border-t border-border pt-5"><p className="font-heading text-lg tracking-tight">Connected, by design.</p><p className="text-[11px] text-muted-foreground mt-2">The home of your growing hive.</p></div>}
      <div className={`flex items-center gap-3 px-5 py-5 border-t border-border ${collapsed ? 'flex-col justify-center' : ''}`}>
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
            <div className="flex-1 min-w-0"><p className="text-xs font-semibold">Administrator</p><p className="text-muted-foreground text-[10px] truncate mt-1" title={userEmail}>{userEmail}</p></div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={handleSignOut}
                    type="button"
                    aria-label="Sign out"
                    title="Sign out"
                    className="p-1.5 text-muted-foreground hover:text-foreground shrink-0"
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
                  className="p-1.5 text-muted-foreground hover:text-foreground"
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
      <aside className="hidden md:flex h-full shrink-0">
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
