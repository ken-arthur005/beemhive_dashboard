'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Dialog } from '@base-ui/react/dialog'
import { Menu, Sun, Moon, X, LogOut, UserRound } from 'lucide-react'
import Brand from '@/components/shared/brand'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuGroup, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import useReducedMotion from '@/components/shared/use-reduced-motion'
import { useCustomerProfile } from './customer-profile-context'

const NAV_ITEMS = [
  { label: 'Overview', href: '/customer/overview' },
  { label: 'My Profile', href: '/customer/profile' },
  { label: 'My Cards', href: '/customer/my-cards' },
  { label: 'Analytics', href: '/customer/analytics' },
]
gsap.registerPlugin(useGSAP)

export default function CustomerHeader({ userEmail }) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { profile, confirmNavigation } = useCustomerProfile()
  const [open, setOpen] = useState(false)
  const [navWidth, setNavWidth] = useState(0)
  const trigger = useRef(null)
  const nav = useRef(null)
  const indicator = useRef(null)
  const positioned = useRef(false)
  const reduced = useReducedMotion()
  const dark = resolvedTheme === 'dark'
  useEffect(() => {
    const observer = new ResizeObserver(entries => setNavWidth(entries[0].contentRect.width))
    observer.observe(nav.current)
    return () => observer.disconnect()
  }, [])
  useGSAP(() => {
    const active = nav.current.querySelector('[aria-current="page"]')
    if (!active) return
    const target = active.getBoundingClientRect()
    if (!target.width) return
    const bounds = nav.current.getBoundingClientRect()
    gsap.to(indicator.current, { x: target.left-bounds.left-1, y: target.top-bounds.top-1, scaleX: target.width/100, scaleY: target.height/40, duration: reduced || !positioned.current ? 0 : .45, ease: 'power3.out', overwrite: true })
    positioned.current = true
  }, { scope: nav, dependencies: [pathname, reduced, navWidth] })

  function navigate(event) { if (!confirmNavigation()) event.preventDefault(); else setOpen(false) }
  async function signOut() {
    if (!confirmNavigation()) return
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      router.replace('/login')
    } catch { toast.error('Could not sign out. Please try again.') }
  }
  const links = NAV_ITEMS.map(item => <Link key={item.href} href={item.href} data-customer-navigation onNavigate={navigate} aria-current={pathname === item.href ? 'page' : undefined}>{item.label}</Link>)

  return <header className="hive-customer-header">
    <Link href="/customer/overview" data-customer-navigation onNavigate={navigate} aria-label="Beem Hive overview"><Brand /></Link>
    <nav ref={nav} aria-label="Customer navigation" className="hive-topnav hive-desktop-nav"><span ref={indicator} className="hive-nav-indicator" aria-hidden="true" />{links}</nav>
    <div className="hive-header-controls">
      <button className="hive-icon-button" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button className="hive-icon-button" aria-label="Account menu" />}>
          {profile.photo_url ? <Image src={profile.photo_url} width={38} height={38} unoptimized alt="" className="hive-avatar" /> : <span className="hive-avatar">{(profile.name || userEmail || '?')[0].toUpperCase()}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60 p-2 rounded-2xl">
          <DropdownMenuGroup><DropdownMenuLabel className="px-3 py-3"><span className="block text-foreground text-sm mb-1">{profile.name || 'Your account'}</span><span className="block truncate max-w-56">{userEmail}</span></DropdownMenuLabel>
            <DropdownMenuItem className="px-3 py-3" onClick={() => { if (confirmNavigation()) router.push('/customer/profile') }}><UserRound />My Profile</DropdownMenuItem>
            <DropdownMenuItem className="px-3 py-3" onClick={signOut}><LogOut />Sign out</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <button ref={trigger} className="hive-icon-button hive-mobile-trigger" aria-label="Open navigation" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}><Menu size={21} /></button>
    </div>
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup finalFocus={trigger} className="fixed top-3 left-3 right-3 z-50 rounded-3xl bg-card border border-border p-2 shadow-xl outline-none">
          <Dialog.Title className="sr-only">Customer navigation</Dialog.Title>
          <Dialog.Description className="sr-only">Navigate your profile, cards, and analytics.</Dialog.Description>
          <div className="flex items-center justify-between px-5 pt-3"><Brand /><Dialog.Close className="hive-icon-button" aria-label="Close navigation"><X size={20} /></Dialog.Close></div>
          <nav aria-label="Mobile customer navigation" className="hive-mobile-nav">{links}</nav>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </header>
}
