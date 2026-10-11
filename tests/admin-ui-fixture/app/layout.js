import './admin-ui.css'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { DM_Sans, Manrope, Geist_Mono } from 'next/font/google'

const body = DM_Sans({ variable: '--font-interface', subsets: ['latin'] })
const heading = Manrope({ variable: '--font-display', subsets: ['latin'] })
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export default function TestLayout({ children }) {
  return <html lang="en" suppressHydrationWarning className={`${body.variable} ${heading.variable} ${mono.variable}`}><body><ThemeProvider attribute="class" defaultTheme="light">{children}<Toaster /></ThemeProvider></body></html>
}
