'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight, Wifi, CreditCard, MonitorSmartphone, Disc } from 'lucide-react'
import Brand from '@/components/shared/brand'

gsap.registerPlugin(useGSAP)
export const PRODUCT_LABELS = { card: 'NFC Card', stand: 'NFC Stand', round_tag: 'Round Tag' }
const PRODUCT_ICONS = { card: CreditCard, stand: MonitorSmartphone, round_tag: Disc }
export function itemEnabled(item) { return !item.retired_at && (item.is_active === true || item.status === 'enabled' || item.status === 'active') }

export function ProductVisual({ item, name, className = '' }) {
  return <div className={`hive-product-card ${className}`}>
    <div className="flex items-center justify-between"><Brand /><Wifi size={21} className="rotate-90 opacity-70" /></div>
    <div><small>{PRODUCT_LABELS[item?.product_type] || 'Digital connections'}</small><strong>{name || 'Your next introduction'}</strong>
      {item?.slug && <span className="block text-[10px] mt-3 opacity-60 font-mono truncate">/t/{item.slug}</span>}
    </div>
  </div>
}

export default function NfcCollection({ items = [], name }) {
  const root = useRef(null)
  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const cards = root.current.querySelectorAll('.hive-product-card')
      gsap.from(cards, { y: 35, rotation: 0, opacity: 0, duration: .85, stagger: .12, delay: .2, ease: 'power3.out', clearProps: 'all' })
    })
    media.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => {
      const stack = root.current.querySelector('.hive-card-stack')
      const cards = stack.querySelectorAll('.hive-product-card')
      if (!cards.length) return
      const rotateX = gsap.quickTo(stack, 'rotationX', { duration: .65, ease: 'power3.out' })
      const rotateY = gsap.quickTo(stack, 'rotationY', { duration: .65, ease: 'power3.out' })
      function move(event) {
        const bounds = stack.getBoundingClientRect()
        rotateX(-((event.clientY - bounds.top) / bounds.height - .5) * 12)
        rotateY(((event.clientX - bounds.left) / bounds.width - .5) * 12)
      }
      function reset() { rotateX(0); rotateY(0) }
      stack.addEventListener('pointermove', move)
      stack.addEventListener('pointerleave', reset)
      return () => { stack.removeEventListener('pointermove', move); stack.removeEventListener('pointerleave', reset) }
    })
    return () => media.revert()
  }, { scope: root, dependencies: [items.length], revertOnUpdate: true })
  return <section ref={root} data-reveal className="hive-panel hive-panel-pad hive-collection">
    <div className="flex justify-between items-center gap-3"><h2 className="hive-section-title">Your collection <sup className="text-xs text-muted-foreground ml-1">{items.length}</sup></h2><Link href="/customer/my-cards" className="hive-icon-button" aria-label="Manage your NFC collection"><ArrowUpRight size={20} /></Link></div>
    <div className="hive-card-stack" aria-hidden="true">{items.length ? items.slice(0,3).map(item => <ProductVisual key={item.id} item={item} name={name} />) : <ProductVisual name="Your next introduction" />}</div>
    <div className="hive-collection-list">{items.length ? items.slice(0,3).map(item => {
      const Icon = PRODUCT_ICONS[item.product_type] || CreditCard
      return <div className="hive-collection-row" key={item.id}><Icon size={19} strokeWidth={1.5} /><div><p>{PRODUCT_LABELS[item.product_type] || 'NFC Item'}</p><small className="block truncate">/t/{item.slug}</small></div><span className="hive-status text-muted-foreground">{item.retired_at ? 'Retired' : itemEnabled(item) ? 'Enabled' : 'Paused'}</span></div>
    }) : <div className="border-t border-border pt-5"><p className="text-sm font-medium">A small card. A bigger network.</p><p className="text-xs leading-relaxed text-muted-foreground mt-2">Your assigned NFC products will appear here. In the meantime, make your profile your own.</p></div>}</div>
    <Link href="/customer/my-cards" className="hive-text-link mt-5">Explore your collection <ArrowUpRight size={15} /></Link>
  </section>
}
