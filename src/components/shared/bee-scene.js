'use client'

import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { useGSAP } from '@gsap/react'
import { RotateCcw } from 'lucide-react'
import { BeeMark } from './brand'
import useReducedMotion from './use-reduced-motion'

gsap.registerPlugin(useGSAP, MotionPathPlugin, DrawSVGPlugin)

export default function BeeScene({ compact = false }) {
  const root = useRef(null)
  const [replay, setReplay] = useState(0)
  const reduced = useReducedMotion()
  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add(`(prefers-reduced-motion: no-preference) and (${compact ? 'max' : 'min'}-width: ${compact ? 800 : 801}px)`, () => {
      let alreadyPlayed = false
      try { alreadyPlayed = sessionStorage.getItem('beem-bee-intro') === 'played' } catch { /* Animation is optional when storage is unavailable. */ }
      if (alreadyPlayed && replay === 0) return
      const flight = root.current.querySelector('.bee-flight')
      const bee = root.current.querySelector('.bee-traveller')
      const logo = root.current.querySelector('.bee-final-logo')
      const strokes = root.current.querySelectorAll('.bee-signal')
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => {
        // Mark a completed flight, not setup: React Strict Mode replays setup.
        try { sessionStorage.setItem('beem-bee-intro', 'played') } catch { /* Optional preference. */ }
      } })
      timeline.set(logo, { opacity: 0 })
        .set(bee, { opacity: 1 })
        .set(flight, { opacity: .8 })
        .fromTo(flight, { drawSVG: '0%' }, { drawSVG: '100%', duration: 2.15, ease: 'power1.inOut' }, 0)
        .to(bee, { duration: 2.15, motionPath: { path: flight, align: flight, alignOrigin: [.5,.5] }, ease: 'power1.inOut' }, 0)
        .to(bee, { opacity: 0, duration: .25 }, 2)
        .fromTo(logo, { y: 8, scale: .94 }, { opacity: 1, y: 0, scale: 1, transformOrigin: '50% 50%', duration: .6 }, 2)
        .from(strokes, { drawSVG: '0%', duration: .45, stagger: .12 }, 2.1)
        .to(flight, { opacity: .2, duration: .7 }, 2.2)
    })
    return () => media.revert()
  }, { scope: root, dependencies: [replay, compact], revertOnUpdate: true })

  return <div ref={root} className="hive-bee-scene">
    <svg viewBox="0 0 440 290" className="hive-bee-art" role="img" aria-label="The Beem Hive bee flies home, leaving a trail of connections">
      <circle cx="220" cy="140" r="132" fill="none" stroke="#5c4d2712" />
      <circle cx="220" cy="140" r="106" fill="none" stroke="#5c4d2712" />
      <path className="bee-flight" opacity=".2" d="M -40 165 C 55 30 140 30 120 150 C 105 245 310 260 340 135 C 370 10 245 12 220 90" stroke="#846622" strokeWidth="1.5" fill="none" />
      <g className="bee-traveller" opacity="0"><BeeMark x="-22" y="-16" width="44" height="33" /></g>
      <g className="bee-final-logo"><image href="/logo.png" x="145" y="40" width="150" height="182" /></g>
      <g stroke="#b89128" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".55"><path className="bee-signal" d="M195 240 Q220 258 245 240" /><path className="bee-signal" d="M182 251 Q220 280 258 251" /></g>
    </svg>
    {!reduced && <button type="button" onClick={() => setReplay(value => value + 1)} className="hive-bee-replay" aria-label="Replay bee animation"><RotateCcw size={13} />Replay the flight</button>}
  </div>
}
