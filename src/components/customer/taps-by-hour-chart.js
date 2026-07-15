'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from 'recharts'

function formatHour(h) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

export default function TapsByHourChart({ data, loading, isDark }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="h-[240px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    )
  }

  const currentHour = new Date().getHours()
  const axisColor = isDark ? '#6b7280' : '#9ca3af'
  const gridColor = isDark ? '#1f2937' : '#f3f4f6'

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Taps by time of day</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis
            dataKey="hour"
            tickFormatter={formatHour}
            tick={{ fontSize: 10, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: isDark ? '#111827' : '#ffffff',
              border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              borderRadius: '8px',
              fontSize: '12px',
              color: isDark ? '#f3f4f6' : '#111827',
            }}
            formatter={(value, _, props) => [`${value} taps`, `at ${formatHour(props.payload.hour)}`]}
            labelFormatter={() => ''}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.hour}
                fill={entry.hour === currentHour ? '#fbbf24' : '#f59e0b'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
