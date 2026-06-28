'use client'

import { MousePointerClick, CreditCard, Users, Zap } from 'lucide-react'
import StatCard from '@/components/shared/stat-card'

export default function AnalyticsStats({
  totalItems,
  totalCustomers,
  tapsToday,
  totalTapsInRange,
  trendPct,
  statsLoading,
  tapsLoading,
}) {
  const loading = statsLoading || tapsLoading

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={MousePointerClick}
        value={tapsLoading ? null : totalTapsInRange.toLocaleString()}
        label="Total taps"
        trend={trendPct}
        loading={tapsLoading}
      />
      <StatCard
        icon={CreditCard}
        value={statsLoading ? null : totalItems.toLocaleString()}
        label="NFC items"
        loading={statsLoading}
      />
      <StatCard
        icon={Users}
        value={statsLoading ? null : totalCustomers.toLocaleString()}
        label="Customers"
        loading={statsLoading}
      />
      <StatCard
        icon={Zap}
        value={statsLoading ? null : tapsToday.toLocaleString()}
        label="Taps today"
        loading={statsLoading}
      />
    </div>
  )
}
