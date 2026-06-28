'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { BarChart2 } from 'lucide-react'
import { createClient } from '../../../../../lib/supabase/client'
import AnalyticsStats from '@/components/admin/analytics-stats'
import TopItemsList from '@/components/admin/top-items-list'
import ActivityFeed from '@/components/admin/activity-feed'
import TapsOverTimeChart from '@/components/shared/taps-over-time-chart'
import DeviceBreakdownChart from '@/components/shared/device-breakdown-chart'

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

export default function AdminAnalyticsPage() {
  const supabase = createClient()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [range, setRange] = useState('7D')
  const rangeDays = RANGE_OPTIONS.find(r => r.label === range)?.days ?? null

  // Query 1 state — summary stats (fires once)
  const [statsLoading, setStatsLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [tapsToday, setTapsToday] = useState(0)

  // Query 2 state — time-series (re-fires on range change)
  const [tapsLoading, setTapsLoading] = useState(true)
  const [tapEvents, setTapEvents] = useState([])

  // Query 3 state — leaderboard + device + activity (fires once)
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState([])
  const [deviceTotals, setDeviceTotals] = useState({ mobile: 0, desktop: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const customerLookupRef = useRef({})

  // Query 1 — summary stats (never re-fires)
  useEffect(() => {
    async function loadStats() {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [itemsRes, customersRes, todayRes] = await Promise.all([
        supabase.from('nfc_items').select('*', { count: 'exact', head: true }),
        supabase.from('users_roles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('tap_events').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      ])

      setTotalItems(itemsRes.count ?? 0)
      setTotalCustomers(customersRes.count ?? 0)
      setTapsToday(todayRes.count ?? 0)
      setStatsLoading(false)
    }
    loadStats()
  }, [])

  // Query 2 — time-series (re-fires on range change only)
  useEffect(() => {
    async function loadTimeSeries() {
      setTapsLoading(true)
      const startDate = getRangeStart(rangeDays, 2)

      let q = supabase
        .from('tap_events')
        .select('created_at, nfc_item_id')
        .order('created_at', { ascending: true })

      if (startDate) q = q.gte('created_at', startDate)

      const { data } = await q
      setTapEvents(data ?? [])
      setTapsLoading(false)
    }
    loadTimeSeries()
  }, [range])

  // Query 3 — leaderboard + device breakdown + activity feed (fires once)
  useEffect(() => {
    async function loadLeaderboardData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/admin/analytics', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        setLeaderboardLoading(false)
        return
      }
      const data = await res.json()
      setLeaderboard(data.leaderboard ?? [])
      setDeviceTotals(data.deviceTotals ?? { mobile: 0, desktop: 0 })
      setRecentActivity(data.recentActivity ?? [])
      customerLookupRef.current = data.customerLookup ?? {}
      setLeaderboardLoading(false)
    }
    loadLeaderboardData()
  }, [])

  // Activity feed refresh (called by ActivityFeed every 60s)
  const refreshActivity = useCallback(async () => {
    const { data } = await supabase
      .from('tap_events')
      .select('id, created_at, device_type, nfc_items(slug, owner_id)')
      .order('created_at', { ascending: false })
      .limit(20)

    if (!data) return

    const lookup = customerLookupRef.current
    const mapped = data.map(tap => ({
      id: tap.id,
      created_at: tap.created_at,
      device_type: tap.device_type,
      slug: tap.nfc_items?.slug ?? null,
      owner_email: tap.nfc_items?.owner_id ? (lookup[tap.nfc_items.owner_id] ?? null) : null,
    }))
    setRecentActivity(mapped)
  }, [])

  // ── Derived data ─────────────────────────────────────────────────────────────

  const periodBoundary = useMemo(() => {
    if (!rangeDays) return null
    return getRangeStart(rangeDays, 1)
  }, [range])

  const filteredEvents = useMemo(() => {
    if (!rangeDays) return tapEvents
    return tapEvents.filter(e => e.created_at >= periodBoundary)
  }, [tapEvents, periodBoundary, range])

  const previousEvents = useMemo(() => {
    if (!rangeDays) return []
    const prevStart = getRangeStart(rangeDays, 2)
    return tapEvents.filter(e => e.created_at >= prevStart && e.created_at < periodBoundary)
  }, [tapEvents, periodBoundary, range])

  const totalTapsInRange = filteredEvents.length
  const prevTotal = previousEvents.length
  const trendPct = prevTotal > 0 ? ((totalTapsInRange - prevTotal) / prevTotal) * 100 : null

  const timeSeriesData = useMemo(() => {
    const dates = []
    if (rangeDays) {
      for (let i = rangeDays - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400 * 1000)
        dates.push(d.toISOString().slice(0, 10))
      }
    } else {
      if (filteredEvents.length > 0) {
        const allDates = new Set(filteredEvents.map(e => toDateStr(e.created_at)))
        const sorted = Array.from(allDates).sort()
        const start = new Date(sorted[0])
        const end = new Date()
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().slice(0, 10))
        }
      }
    }

    const byDay = {}
    for (const e of filteredEvents) {
      const d = toDateStr(e.created_at)
      byDay[d] = (byDay[d] ?? 0) + 1
    }
    return dates.map(date => ({ date, taps: byDay[date] ?? 0 }))
  }, [filteredEvents, range])

  const timeSeriesLines = [{ key: 'taps', color: '#10b981', label: 'Taps' }]

  // ── Render ───────────────────────────────────────────────────────────────────

  const noData = !leaderboardLoading && !tapsLoading && totalTapsInRange === 0 && recentActivity.length === 0

  return (
    <div className="space-y-6">
      <PageHeader range={range} setRange={setRange} />

      <AnalyticsStats
        totalItems={totalItems}
        totalCustomers={totalCustomers}
        tapsToday={tapsToday}
        totalTapsInRange={totalTapsInRange}
        trendPct={trendPct}
        statsLoading={statsLoading}
        tapsLoading={tapsLoading}
      />

      {noData ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-16 flex flex-col items-center gap-3">
          <BarChart2 size={48} className="text-gray-300 dark:text-gray-700" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">No tap data yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
            Tap analytics will appear here once customers start using their NFC cards.
          </p>
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
            <TopItemsList items={leaderboard} loading={leaderboardLoading} />
            <DeviceBreakdownChart
              mobile={deviceTotals.mobile}
              desktop={deviceTotals.desktop}
              loading={leaderboardLoading}
              isDark={isDark}
            />
          </div>

          <ActivityFeed
            activity={recentActivity}
            loading={leaderboardLoading}
            onRefresh={refreshActivity}
          />
        </>
      )}
    </div>
  )
}

function PageHeader({ range, setRange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Platform-wide tap activity and performance
        </p>
      </div>
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
  )
}
