'use client'

import { useEffect, useRef } from 'react'

function sourceOrigin() {
  try { return new URL(document.referrer).origin } catch { return '' }
}

// Keep native destinations (including tel/mailto), new tabs, and keyboard use.
// Analytics failure must never prevent a connection. Only published pages mount
// this wrapper; the shared draft/phone presentation never emits events.
export default function ProfileTracking({ slug, revision, children }) {
  const visit = useRef(null)
  const viewRequest = useRef(null)

  function view() {
    visit.current ||= crypto.randomUUID()
    viewRequest.current ||= fetch('/api/public/events', {
      method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, revision, type: 'profile_view', eventId: visit.current, visitId: visit.current, referrer: sourceOrigin() }),
    }).then(response => response.ok ? response.json() : null).catch(() => null)
    return viewRequest.current
  }

  useEffect(() => {
    function visible() { if (document.visibilityState === 'visible') view() }
    visible()
    document.addEventListener('visibilitychange', visible)
    return () => document.removeEventListener('visibilitychange', visible)
    // One UUID per mounted published page also deduplicates StrictMode effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, revision])

  function click(event) {
    if (event.type === 'auxclick' && event.button !== 1) return
    const link = event.target.closest?.('a[data-profile-link][href]')
    if (!link) return
    const eventId = crypto.randomUUID()
    view().then(result => {
      if (!result?.recorded) return
      return fetch('/api/public/events', {
        method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, revision, type: 'link_click', eventId, visitId: visit.current, linkIndex: Number(link.dataset.profileLink), referrer: sourceOrigin() }),
      })
    }).catch(() => { /* Connections stay usable when analytics is unavailable. */ })
  }

  return <div onClickCapture={click} onAuxClickCapture={click}>{children}</div>
}
