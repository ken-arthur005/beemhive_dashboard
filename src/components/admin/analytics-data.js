// Aggregate API boundary. Keep field-shape adjustments here when the final
// analytics_summary schema is supplied; never infer counts from raw events.
export function normalizeAnalytics(data) {
  for (const key of ['totalTaps', 'todayCount', 'contactDownloads', 'totalCustomers', 'totalItems']) {
    if (!Number.isFinite(data?.[key])) throw new Error(`Analytics response is missing ${key}. Please retry after the API schema is available.`)
  }
  for (const key of ['daily', 'hourly', 'leaderboard', 'recentActivity']) {
    if (!Array.isArray(data[key])) throw new Error(`Analytics response is missing ${key}. Please retry.`)
  }
  if (!data.deviceTotals || typeof data.deviceTotals !== 'object') throw new Error('Analytics response is missing device totals. Please retry.')
  const total = period => typeof period === 'number' ? period : period?.totalTaps
  const current = total(data.current)
  const previous = total(data.previous)
  const count = bucket => bucket.taps ?? bucket.count
  const daily = data.daily.map(bucket => {
    if (typeof bucket.date !== 'string' || !Number.isFinite(count(bucket))) throw new Error('Analytics daily bucket format is unavailable. Please retry.')
    return { date: bucket.date, taps: count(bucket) }
  })
  const hourly = data.hourly.map(bucket => {
    if (bucket.hour == null || !Number.isFinite(count(bucket))) throw new Error('Analytics hourly bucket format is unavailable. Please retry.')
    return { hour: bucket.hour, taps: count(bucket) }
  })
  return {
    ...data,
    daily,
    hourly,
    trendPct: Number.isFinite(current) && Number.isFinite(previous) && previous > 0 ? ((current - previous) / previous) * 100 : null,
    leaderboard: data.leaderboard.map(item => ({ ...item, tap_count: item.tap_count ?? item.tapCount, owner_email: item.owner_email ?? item.ownerEmail })),
  }
}
