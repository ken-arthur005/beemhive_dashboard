'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import AnalyticsStats from '@/components/admin/analytics-stats'
import TopItemsList from '@/components/admin/top-items-list'
import ActivityFeed from '@/components/admin/activity-feed'
import TapsOverTimeChart from '@/components/shared/taps-over-time-chart'
import DeviceBreakdownChart from '@/components/shared/device-breakdown-chart'
import { useAdminResource } from '@/components/admin/use-admin-resource'
import { normalizeAnalytics } from '@/components/admin/analytics-data'
import { Notice, cardClass } from '@/components/admin/admin-controls'

const RANGES = [{ label: '7D', days: '7' }, { label: '30D', days: '30' }, { label: '90D', days: '90' }, { label: 'All', days: 'all' }]

export default function AdminAnalyticsPage() {
  const { resolvedTheme } = useTheme()
  const [days, setDays] = useState('7')
  const { data, loading, error, reload } = useAdminResource(`/api/admin/analytics?${new URLSearchParams({ days })}`, normalizeAnalytics)

  const rangeLabel = RANGES.find(range => range.days === days)?.label
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold">Analytics</h1><p className="mt-0.5 text-sm text-gray-500">Platform-wide activity · UTC calendar days · assignment-at-event ownership</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700" role="group" aria-label="Analytics period">{RANGES.map(range => <button key={range.days} type="button" aria-pressed={days === range.days} onClick={() => setDays(range.days)} className={`px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-amber-500 ${days === range.days ? 'bg-amber-500 text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{range.label}</button>)}</div>
        <Button variant="outline" size="sm" disabled={loading} onClick={reload}>Refresh</Button>
      </div>
    </div>
    {loading && <p role="status" className="text-sm text-gray-500">Loading aggregate analytics…</p>}
    {error ? <div className={`${cardClass} space-y-3 p-6`}><Notice error={error} /><Button variant="outline" onClick={reload}>Retry analytics</Button></div> : <>
      <AnalyticsStats totalItems={data?.totalItems} totalCustomers={data?.totalCustomers} tapsToday={data?.todayCount} totalTapsInRange={data?.totalTaps} trendPct={data?.trendPct} statsLoading={loading} tapsLoading={loading} />
      {!loading && data && <>
        <p className="text-sm text-gray-500">Contact downloads in this period: <strong className="text-gray-900 dark:text-gray-100">{data.contactDownloads.toLocaleString()}</strong></p>
        <TapsOverTimeChart data={data.daily} lines={[{ key: 'taps', color: '#f59e0b', label: 'Taps' }]} loading={false} isDark={resolvedTheme === 'dark'} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TopItemsList items={data.leaderboard} loading={false} period={rangeLabel === 'All' ? 'All time' : `Last ${days} days`} />
          <DeviceBreakdownChart mobile={data.deviceTotals.mobile ?? 0} desktop={data.deviceTotals.desktop ?? 0} tablet={data.deviceTotals.tablet ?? 0} unknown={data.deviceTotals.unknown ?? 0} loading={false} isDark={resolvedTheme === 'dark'} />
        </div>
        <details className={`${cardClass} p-5`}><summary className="cursor-pointer text-sm font-medium">Hourly taps (UTC)</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr><th scope="col" className="py-2 text-left">Hour</th><th scope="col" className="py-2 text-right">Taps</th></tr></thead><tbody>{data.hourly.map(bucket => <tr key={bucket.hour}><td className="py-1">{bucket.hour}</td><td className="text-right tabular-nums">{bucket.taps.toLocaleString()}</td></tr>)}</tbody></table>{!data.hourly.length && <p className="text-sm text-gray-500">No hourly activity for this period.</p>}</div></details>
        <ActivityFeed activity={data.recentActivity} loading={false} />
      </>}
    </>}
  </div>
}
