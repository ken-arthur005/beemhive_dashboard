'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { MousePointerClick, Zap, TrendingUp, Contact } from 'lucide-react'
import { customerRequest, useCustomerProfile } from '@/components/customer/customer-profile-context'
import StatCard from '@/components/shared/stat-card'
import TapsOverTimeChart from '@/components/shared/taps-over-time-chart'
import DeviceBreakdownChart from '@/components/shared/device-breakdown-chart'
import TapsByHourChart from '@/components/customer/taps-by-hour-chart'
import PerCardBreakdown from '@/components/customer/per-card-breakdown'

const RANGES = [{ label: '7D', days: '7' }, { label: '30D', days: '30' }, { label: '90D', days: '90' }, { label: 'All', days: 'all' }]

export default function CustomerAnalyticsPage() {
  const { resolvedTheme } = useTheme()
  const { items } = useCustomerProfile()
  const [days, setDays] = useState('7')
  const [item, setItem] = useState('all')
  const [cards, setCards] = useState(items ?? [])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const query = new URLSearchParams({ days })
        if (item !== 'all') query.set('item', item)
        const data = await customerRequest(`/api/customer/analytics?${query}`, { signal: controller.signal })
        if (!cancelled) {
          setSummary(data)
          if (item === 'all') setCards(data.cards ?? [])
        }
      } catch (failure) { if (!cancelled) setError(failure.message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true; controller.abort() }
  }, [days, item, attempt])

  // Server UTC calendar buckets and assignment ownership are authoritative.
  const total = summary?.totalTaps ?? 0
  const previous = summary?.previousTaps ?? 0
  const trend = days !== 'all' && previous > 0 ? (total - previous) / previous * 100 : null
  const daily = summary?.daily ?? []
  const bestDay = daily.reduce((best, day) => !best || day.taps > best.taps ? day : best, null)
  const devices = summary?.deviceTotals ?? {}
  const latest = typeof summary?.latestEvent === 'string' ? summary.latestEvent : summary?.latestEvent?.created_at
  const isDark = resolvedTheme === 'dark'

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Profile views and contact downloads · UTC calendar dates</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="analytics-item" className="sr-only">Filter analytics by NFC item</label>
        <select id="analytics-item" value={item} onChange={event => setItem(event.target.value)} className="max-w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-xs focus:outline-amber-500">
          <option value="all">All assigned items and history</option>
          {cards.map(card => <option key={card.id} value={card.id}>/t/{card.slug || 'Retired item'}</option>)}
        </select>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" aria-label="Analytics period">
          {RANGES.map(range => <button key={range.days} onClick={() => setDays(range.days)} aria-pressed={days === range.days}
            className={`px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-amber-500 ${days === range.days ? 'bg-amber-500 text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{range.label}</button>)}
        </div>
      </div>
    </header>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-900 p-5 text-sm text-rose-600 dark:text-rose-400"><p>{error}</p><button className="mt-2 underline" onClick={() => setAttempt(value => value + 1)}>Retry analytics</button></div> : <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MousePointerClick} value={total.toLocaleString()} label="Profile views" trend={trend} loading={loading} />
        <StatCard icon={Zap} value={(summary?.todayTaps ?? 0).toLocaleString()} label="Profile views today" loading={loading} />
        <StatCard icon={TrendingUp} value={bestDay?.taps ? `${bestDay.date} · ${bestDay.taps}` : '—'} label="Best day · UTC" loading={loading} />
        <StatCard icon={Contact} value={(summary?.contactDownloads ?? 0).toLocaleString()} label="Contact downloads" loading={loading} />
      </div>
      {!loading && total === 0 && <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold">No profile views in this period</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try a longer range. New views are recorded when visitors open an enabled item with a published profile.</p>
      </div>}
      <TapsOverTimeChart data={daily} lines={[{ key: 'taps', color: '#f59e0b', label: 'Profile views' }]} loading={loading} isDark={isDark} />
      <div className="grid md:grid-cols-2 gap-6">
        <DeviceBreakdownChart mobile={devices.mobile ?? 0} desktop={devices.desktop ?? 0} tablet={devices.tablet ?? 0} unknown={devices.unknown ?? 0} loading={loading} isDark={isDark} />
        <TapsByHourChart data={(summary?.hourly ?? []).map(bucket => ({ hour: bucket.hour, count: bucket.taps }))} loading={loading} isDark={isDark} />
      </div>
      {!loading && summary?.cards?.length > 0 && <PerCardBreakdown cards={summary.cards} period={days === 'all' ? 'All time' : `Last ${days} UTC days`} />}
      {!loading && latest && <p className="text-xs text-gray-500">Latest activity: {new Date(latest).toLocaleString(undefined, { timeZone: 'UTC' })} UTC</p>}
    </>}
  </div>
}
