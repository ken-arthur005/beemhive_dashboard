'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const PALETTE = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#f43f5e']

function formatXDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`
}

export default function TapsOverTimeChart({ data, lines, loading, isDark }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="h-[260px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    )
  }

  const axisColor = isDark ? '#6b7280' : '#9ca3af'
  const gridColor = isDark ? '#1f2937' : '#f3f4f6'

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Taps over time</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis
            dataKey="date"
            tickFormatter={formatXDate}
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
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
            labelFormatter={formatXDate}
          />
          {lines.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px', color: isDark ? '#9ca3af' : '#6b7280' }}
            />
          )}
          {lines.map((line, i) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color ?? PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
