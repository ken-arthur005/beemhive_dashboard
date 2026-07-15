'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UserCircle, CreditCard, BarChart2, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCustomerProfile } from './customer-profile-context'

const NAV_ITEMS = [
  { label: 'My Profile', icon: UserCircle, href: '/customer/profile' },
  { label: 'My Cards', icon: CreditCard, href: '/customer/my-cards' },
  { label: 'Analytics', icon: BarChart2, href: '/customer/analytics' },
]

function NavItem({ item, isCollapsed, onClick }) {
  const pathname = usePathname()
  const isActive = pathname === item.href
  const Icon = item.icon

  const linkClass = `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
    ${isActive
      ? 'bg-amber-500 text-gray-900 dark:bg-amber-400 dark:text-gray-900'
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

function ProfileAvatar({ size = 'sm' }) {
  const { profile } = useCustomerProfile()
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'

  if (profile.photo_url) {
    return (
      <img
        src={profile.photo_url}
        alt="Profile"
        className={`${dim} rounded-full object-cover shrink-0`}
      />
    )
  }

  const initial = profile.name ? profile.name[0].toUpperCase() : '?'
  return (
    <div className={`${dim} rounded-full bg-amber-500 flex items-center justify-center text-gray-900 font-medium shrink-0`}>
      {initial}
    </div>
  )
}

export default function CustomerSidebar({ isCollapsed, isMobileOpen, onToggleCollapse, onCloseMobile, userEmail }) {
  const router = useRouter()
  const { profile } = useCustomerProfile()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const identityTooltipLabel = profile.name || userEmail

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-gray-900 dark:bg-gray-950 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo + collapse toggle */}
      <div className={`flex items-center gap-3 px-3 py-4 border-b border-gray-800 ${isCollapsed ? 'justify-center' : ''}`}>
        <Image src="/logo.png" alt="Beem Hive" width={24} height={24} className="shrink-0 rounded-sm" />
        {!isCollapsed && (
          <>
            <span className="text-gray-100 font-semibold text-sm flex-1">Beem Hive</span>
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
        {isCollapsed && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={onToggleCollapse}
                  className="p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
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

      {/* Identity + sign out */}
      <div className={`flex items-center gap-2 px-3 py-3 border-t border-gray-800 ${isCollapsed ? 'justify-center flex-col gap-2' : ''}`}>
        {isCollapsed ? (
          <>
            <Tooltip>
              <TooltipTrigger render={<div className="cursor-default" />}>
                <ProfileAvatar />
              </TooltipTrigger>
              <TooltipContent side="right">{identityTooltipLabel}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={handleSignOut}
                    className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                  />
                }
              >
                <LogOut size={15} />
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <ProfileAvatar />
            <div className="flex flex-col min-w-0 flex-1">
              {profile.name ? (
                <span className="text-gray-100 text-xs font-medium truncate">{profile.name}</span>
              ) : (
                <span className="text-gray-500 text-xs italic">Set up your profile</span>
              )}
              <span className="text-gray-400 text-xs truncate" title={userEmail}>{userEmail}</span>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={handleSignOut}
                    className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors shrink-0"
                  />
                }
              >
                <LogOut size={15} />
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </>
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
