'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export default function DeviceBreakdownChart({ mobile, desktop, loading, isDark }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="h-[240px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    )
  }

  const total = mobile + desktop
  const data = [
    { name: 'Mobile', value: mobile },
    { name: 'Desktop', value: desktop },
  ]
  const colors = ['#f59e0b', isDark ? '#451a03' : '#fef3c7']

  if (total === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Device breakdown</p>
        <div className="flex-1 flex items-center justify-center h-[220px] text-sm text-gray-400 dark:text-gray-500">
          No data yet
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Device breakdown</p>
      <div className="relative" style={{ height: 240 }}>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginBottom: 28 }}>
          <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums leading-none">
            {total}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">total</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="46%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: isDark ? '#111827' : '#ffffff',
                border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                borderRadius: '8px',
                fontSize: '12px',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              formatter={(value, name) => [`${value} taps`, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '4px', color: isDark ? '#9ca3af' : '#6b7280' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
