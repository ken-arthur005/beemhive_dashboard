'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CreditCard, Users, BarChart2, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

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
      ? 'bg-emerald-600 text-white dark:bg-emerald-500'
      : 'text-gray-100 dark:text-gray-300 hover:bg-gray-800'
    }
    ${isCollapsed ? 'justify-center px-2' : ''}
  `

  if (!isCollapsed) {
    return (
      <Link href={item.href} onClick={onClick} className={linkClass}>
        <Icon size={18} className="shrink-0" />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link href={item.href} onClick={onClick} className={linkClass} />
        }
      >
        <Icon size={18} className="shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

export default function Sidebar({ isCollapsed, isMobileOpen, onToggleCollapse, onCloseMobile, userEmail }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const userInitial = userEmail ? userEmail[0].toUpperCase() : '?'

  const avatarEl = (
    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-medium shrink-0">
      {userInitial}
    </div>
  )

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-gray-900 dark:bg-gray-950 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-3 py-4 border-b border-gray-800 ${isCollapsed ? 'justify-center' : ''}`}>
        {/* TODO: replace with actual logo */}
        <div className="w-6 h-6 rounded-sm bg-emerald-600 shrink-0" />
        {!isCollapsed && (
          <span className="text-gray-100 font-semibold text-sm">Beem Hive</span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            onClick={onCloseMobile}
          />
        ))}
      </nav>

      <Separator className="bg-gray-800" />

      {/* User info */}
      <div className={`flex items-center gap-3 px-3 py-3 ${isCollapsed ? 'justify-center' : ''}`}>
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger render={<div className="cursor-default" />}>
              {avatarEl}
            </TooltipTrigger>
            <TooltipContent side="right">{userEmail}</TooltipContent>
          </Tooltip>
        ) : (
          <>
            {avatarEl}
            <span className="text-gray-300 text-xs truncate" title={userEmail}>
              {userEmail}
            </span>
          </>
        )}
      </div>

      <Separator className="bg-gray-800" />

      {/* Sign out */}
      <div className="p-2">
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={handleSignOut}
                  className="w-full flex justify-center items-center rounded-md px-2 py-2 text-gray-100 dark:text-gray-300 hover:bg-gray-800 transition-colors"
                />
              }
            >
              <LogOut size={18} />
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-100 dark:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Sign out</span>
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-gray-800">
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={onToggleCollapse}
                  className="w-full flex justify-center items-center rounded-md px-2 py-2 text-gray-100 dark:text-gray-300 hover:bg-gray-800 transition-colors"
                />
              }
            >
              <ChevronRight size={18} />
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={onToggleCollapse}
            className="w-full flex justify-center items-center rounded-md px-2 py-2 text-gray-100 dark:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onCloseMobile}
          />
          <aside className="relative flex h-full z-50">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
