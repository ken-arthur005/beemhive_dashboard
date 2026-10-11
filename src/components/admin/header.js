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

export default function Header({ onOpenMobile, userEmail, mobileTriggerRef, isMobileOpen }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  const pageTitle = PAGE_TITLES[pathname] ?? 'Admin'
  const userInitial = userEmail ? userEmail[0].toUpperCase() : '?'

  return (
    <header className="hive-admin-header shrink-0">
      {/* Mobile hamburger */}
      <button
        ref={mobileTriggerRef}
        type="button"
        onClick={onOpenMobile}
        aria-label="Open navigation"
        title="Open navigation"
        aria-haspopup="dialog"
        aria-expanded={isMobileOpen}
        className="md:hidden p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 flex items-center gap-3 text-xs"><span className="text-muted-foreground hidden sm:inline">Workspace</span><span className="text-muted-foreground hidden sm:inline">/</span><span className="font-medium">{pageTitle}</span></div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="text-gray-600 dark:text-gray-300"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        <Separator orientation="vertical" className="h-6 bg-gray-200 dark:bg-gray-700" />

        {/* Admin avatar — TODO: profile dropdown */}
        <div aria-label={`Signed in as ${userEmail}`} className="hive-avatar">
          {userInitial}
        </div>
      </div>
    </header>
  )
}
