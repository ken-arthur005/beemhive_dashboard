'use client'

import { useSyncExternalStore } from 'react'
function subscribe(callback) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const snapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export default function useReducedMotion() { return useSyncExternalStore(subscribe, snapshot, () => true) }
