'use client'

import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Menu, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const PAGE_TITLES = {
  '/admin/nfc-items': 'NFC Items',
  '/admin/customers': 'Customers',
  '/admin/analytics': 'Analytics',
}

export default function Header({ onOpenMobile, userEmail }) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const pageTitle = PAGE_TITLES[pathname] ?? 'Admin'
  const userInitial = userEmail ? userEmail[0].toUpperCase() : '?'

  return (
    <header className="h-14 flex items-center px-4 gap-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onOpenMobile}
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
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-gray-600 dark:text-gray-300"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        <Separator orientation="vertical" className="h-6 bg-gray-200 dark:bg-gray-700" />

        {/* Admin avatar — TODO: profile dropdown */}
        <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-medium cursor-pointer">
          {userInitial}
        </div>
      </div>
    </header>
  )
}
