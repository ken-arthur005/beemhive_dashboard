'use client'

import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

export default function PageReveal({ children, className = '' }) {
  const root = useRef(null)
  const pathname = usePathname()
  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const elements = root.current.querySelectorAll('[data-reveal]')
      if (elements.length) gsap.from(elements, { y: 24, opacity: 0, duration: 0.7, stagger: 0.075, ease: 'power3.out', clearProps: 'all' })
      else gsap.from(root.current, { y: 12, opacity: 0, duration: 0.5, ease: 'power3.out', clearProps: 'all' })
    })
    return () => media.revert()
  }, { scope: root, dependencies: [pathname], revertOnUpdate: true })
  return <div ref={root} className={`hive-page ${className}`}>{children}</div>
}
