'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { MousePointerClick, Zap, TrendingUp, Contact, CreditCard, BarChart2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import StatCard from '@/components/shared/stat-card'
import TapsOverTimeChart from '@/components/shared/taps-over-time-chart'
import DeviceBreakdownChart from '@/components/shared/device-breakdown-chart'
import TapsByHourChart from '@/components/customer/taps-by-hour-chart'
import PerCardBreakdown from '@/components/customer/per-card-breakdown'

const PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e']

const RANGE_OPTIONS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: null },
]

function getRangeStart(days, multiplier = 1) {
  if (!days) return null
  return new Date(Date.now() - multiplier * days * 86400 * 1000).toISOString()
}

function toDateStr(iso) {
  return iso.slice(0, 10)
}

export default function CustomerAnalyticsPage() {
  const supabase = createClient()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [userId, setUserId] = useState(null)
  const [range, setRange] = useState('7D')
  const [selectedCard, setSelectedCard] = useState('all')
  const [cards, setCards] = useState([])
  const [cardsLoading, setCardsLoading] = useState(true)
  const [tapEvents, setTapEvents] = useState([])
  const [tapsLoading, setTapsLoading] = useState(true)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const rangeDays = RANGE_OPTIONS.find(r => r.label === range)?.days ?? null

  // Get userId once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id)
    })
  }, [])

  // Query 1 — NFC items + all-time tap counts (date-range independent)
  useEffect(() => {
    if (!userId) return
    setCardsLoading(true)
    supabase
      .from('nfc_items')
      .select('id, slug, product_type, is_active, tap_events(count)')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setCards(data ?? [])
        setCardsLoading(false)
      })
  }, [userId])

  // Query 2 — Tap events for selected range (re-runs on range change, not card change)
  useEffect(() => {
    if (!userId || cardsLoading) return
    if (cards.length === 0) {
      setTapsLoading(false)
      return
    }

    setTapsLoading(true)
    const cardIds = cards.map(c => c.id)
    // Fetch 2× range so we have the previous period for trend comparison
    const startDate = getRangeStart(rangeDays, 2)

    let q = supabase
      .from('tap_events')
      .select('id, created_at, device_type, referrer, nfc_item_id')
      .in('nfc_item_id', cardIds)
      .order('created_at', { ascending: true })

    if (startDate) q = q.gte('created_at', startDate)

    q.then(({ data }) => {
      setTapEvents(data ?? [])
      setTapsLoading(false)
    })
  }, [userId, range, cardsLoading])

  // ── Derived data (all via useMemo) ──────────────────────────────────────────

  const periodBoundary = useMemo(() => {
    if (!rangeDays) return null
    return getRangeStart(rangeDays, 1)
  }, [range])

  // Events in the current period, filtered by card selection
  const filteredEvents = useMemo(() => {
    let evts = rangeDays
      ? tapEvents.filter(e => e.created_at >= periodBoundary)
      : tapEvents
    if (selectedCard !== 'all') evts = evts.filter(e => e.nfc_item_id === selectedCard)
    return evts
  }, [tapEvents, periodBoundary, selectedCard, range])

  // Events in the previous period (same length, before current period)
  const previousEvents = useMemo(() => {
    if (!rangeDays) return []
    const prevStart = getRangeStart(rangeDays, 2)
    let evts = tapEvents.filter(e => e.created_at >= prevStart && e.created_at < periodBoundary)
    if (selectedCard !== 'all') evts = evts.filter(e => e.nfc_item_id === selectedCard)
    return evts
  }, [tapEvents, periodBoundary, selectedCard, range])

  const totalTaps = filteredEvents.length
  const prevTotalTaps = previousEvents.length
  const trendPct = prevTotalTaps > 0 ? ((totalTaps - prevTotalTaps) / prevTotalTaps) * 100 : null

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCount = filteredEvents.filter(e => e.created_at.startsWith(todayStr)).length

  const bestDayData = useMemo(() => {
    if (filteredEvents.length === 0) return null
    const byDay = {}
    for (const e of filteredEvents) {
      const d = toDateStr(e.created_at)
      byDay[d] = (byDay[d] ?? 0) + 1
    }
    const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]
    if (!best) return null
    const [dateStr, count] = best
    const [y, m, d] = dateStr.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${parseInt(d)} ${months[parseInt(m) - 1]} — ${count} taps`
  }, [filteredEvents])

  const vcardCount = useMemo(
    () => filteredEvents.filter(e => e.referrer?.toLowerCase().includes('vcard')).length,
    [filteredEvents]
  )

  // Time series data
  const timeSeriesData = useMemo(() => {
    if (filteredEvents.length === 0) return []

    const visibleCards = selectedCard === 'all' ? cards : cards.filter(c => c.id === selectedCard)

    // Build date range
    const dates = []
    if (rangeDays) {
      for (let i = rangeDays - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400 * 1000)
        dates.push(d.toISOString().slice(0, 10))
      }
    } else {
      const allDates = new Set(filteredEvents.map(e => toDateStr(e.created_at)))
      const sorted = Array.from(allDates).sort()
      if (sorted.length > 0) {
        const start = new Date(sorted[0])
        const end = new Date()
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().slice(0, 10))
        }
      }
    }

    if (visibleCards.length <= 1) {
      const byDay = {}
      for (const e of filteredEvents) byDay[toDateStr(e.created_at)] = (byDay[toDateStr(e.created_at)] ?? 0) + 1
      return dates.map(date => ({ date, taps: byDay[date] ?? 0 }))
    }

    // Multi-card: one key per card id (up to 5, rest aggregated as "other")
    const mainCards = visibleCards.slice(0, 5)
    const otherIds = new Set(visibleCards.slice(5).map(c => c.id))

    const byDayCard = {}
    for (const e of filteredEvents) {
      const d = toDateStr(e.created_at)
      if (!byDayCard[d]) byDayCard[d] = {}
      const key = otherIds.has(e.nfc_item_id) ? 'other' : e.nfc_item_id
      byDayCard[d][key] = (byDayCard[d][key] ?? 0) + 1
    }

    return dates.map(date => {
      const row = { date }
      for (const c of mainCards) row[c.id] = byDayCard[date]?.[c.id] ?? 0
      if (otherIds.size > 0) row.other = byDayCard[date]?.other ?? 0
      return row
    })
  }, [filteredEvents, cards, selectedCard, range])

  const timeSeriesLines = useMemo(() => {
    const visibleCards = selectedCard === 'all' ? cards : cards.filter(c => c.id === selectedCard)
    if (visibleCards.length <= 1) {
      return [{ key: 'taps', color: '#10b981', label: 'Taps' }]
    }
    const mainCards = visibleCards.slice(0, 5)
    const lines = mainCards.map((c, i) => ({
      key: c.id,
      color: PALETTE[i],
      label: `/t/${c.slug}`,
    }))
    if (visibleCards.length > 5) lines.push({ key: 'other', color: '#9ca3af', label: 'Other' })
    return lines
  }, [cards, selectedCard])

  const deviceBreakdown = useMemo(() => {
    let mobile = 0, desktop = 0
    for (const e of filteredEvents) {
      if (e.device_type === 'mobile') mobile++
      else desktop++
    }
    return { mobile, desktop }
  }, [filteredEvents])

  const hourlyData = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
    for (const e of filteredEvents) {
      counts[new Date(e.created_at).getHours()].count++
    }
    return counts
  }, [filteredEvents])

  // Profile URL for first card (used in empty state copy button)
  const firstCardUrl = cards[0] ? `https://beemhive.com/t/${cards[0].slug}` : null

  async function copyProfileUrl() {
    if (!firstCardUrl) return
    try { await navigator.clipboard.writeText(firstCardUrl) } catch { /* fallback not needed here */ }
    setCopiedUrl(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedUrl(false), 1500)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // No cards at all
  if (!cardsLoading && cards.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader range={range} setRange={setRange} cards={[]} selectedCard={selectedCard} setSelectedCard={setSelectedCard} />
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <CreditCard size={64} className="text-gray-300 dark:text-gray-700" />
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">No cards assigned yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
            Your analytics will appear once Beem Hive assigns an NFC card to your account.
          </p>
        </div>
      </div>
    )
  }

  const noTapData = !tapsLoading && filteredEvents.length === 0

  return (
    <div className="space-y-6">
      <PageHeader
        range={range}
        setRange={setRange}
        cards={cards}
        selectedCard={selectedCard}
        setSelectedCard={setSelectedCard}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={MousePointerClick}
          value={tapsLoading ? null : totalTaps.toLocaleString()}
          label="Total taps"
          trend={trendPct}
          loading={tapsLoading}
        />
        <StatCard
          icon={Zap}
          value={tapsLoading ? null : todayCount.toLocaleString()}
          label="Profile views today"
          loading={tapsLoading}
        />
        <StatCard
          icon={TrendingUp}
          value={tapsLoading ? null : (bestDayData ?? '—')}
          label="Best day"
          loading={tapsLoading}
        />
        <StatCard
          icon={Contact}
          value={tapsLoading ? null : vcardCount.toLocaleString()}
          label="Save contact clicks"
          tooltip="Estimated based on save contact interactions"
          loading={tapsLoading}
        />
      </div>

      {noTapData ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 flex flex-col items-center gap-3">
          <BarChart2 size={48} className="text-gray-300 dark:text-gray-700" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No taps in this period</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
            Try selecting a longer date range or share your profile link to get started.
          </p>
          {firstCardUrl && (
            <button
              onClick={copyProfileUrl}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-mono text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {copiedUrl ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              {firstCardUrl}
            </button>
          )}
        </div>
      ) : (
        <>
          <TapsOverTimeChart
            data={timeSeriesData}
            lines={timeSeriesLines}
            loading={tapsLoading}
            isDark={isDark}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DeviceBreakdownChart
              mobile={deviceBreakdown.mobile}
              desktop={deviceBreakdown.desktop}
              loading={tapsLoading}
              isDark={isDark}
            />
            <TapsByHourChart
              data={hourlyData}
              loading={tapsLoading}
              isDark={isDark}
            />
          </div>

          {cards.length > 1 && selectedCard === 'all' && !cardsLoading && (
            <PerCardBreakdown cards={cards} />
          )}
        </>
      )}
    </div>
  )
}

function PageHeader({ range, setRange, cards, selectedCard, setSelectedCard }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Your tap activity and profile performance
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {cards.length > 1 && (
          <Select value={selectedCard} onValueChange={setSelectedCard}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cards</SelectItem>
              {cards.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {TYPE_LABELS[c.product_type] ?? 'Card'} — /t/{c.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => setRange(opt.label)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${range === opt.label
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const TYPE_LABELS = {
  card: 'Card',
  stand: 'Stand',
  round_tag: 'Round Tag',
}
