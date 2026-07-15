'use client'

import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Menu, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useCustomerProfile } from './customer-profile-context'

const PAGE_TITLES = {
  '/customer/profile': 'My Profile',
  '/customer/my-cards': 'My Cards',
  '/customer/analytics': 'Analytics',
}

export default function CustomerHeader({ onOpenMobile, userEmail }) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { profile } = useCustomerProfile()
  const pageTitle = PAGE_TITLES[pathname] ?? 'Dashboard'

  const avatarEl = profile.photo_url ? (
    <img
      src={profile.photo_url}
      alt="Profile"
      className="w-7 h-7 rounded-full object-cover cursor-pointer"
    />
  ) : (
    <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-gray-900 text-xs font-medium cursor-pointer">
      {profile.name ? profile.name[0].toUpperCase() : (userEmail ? userEmail[0].toUpperCase() : '?')}
    </div>
  )

  return (
    <header className="h-14 flex items-center px-4 gap-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onOpenMobile}
        aria-label="Open navigation"
        className="md:hidden p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1">
        {pageTitle}
      </span>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="text-gray-600 dark:text-gray-300"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        <Separator orientation="vertical" className="h-6 bg-gray-200 dark:bg-gray-700" />

        {avatarEl}
      </div>
    </header>
  )
}
