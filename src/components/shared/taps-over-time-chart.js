'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import useReducedMotion from './use-reduced-motion'

const PALETTE = ['#d6a52c', '#8e987b', '#c6ad7e', '#656f5f', '#be294c']

function formatXDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`
}

export default function TapsOverTimeChart({ data, lines, loading, isDark, title = 'Profile views over time' }) {
  const reducedMotion = useReducedMotion()
  if (loading) {
    return (
      <div className="hive-chart">
        <div className="h-[260px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    )
  }

  const axisColor = isDark ? '#aaa99d' : '#737269'
  const gridColor = isDark ? '#ffffff0c' : '#eae7dc'
  const hasData = data.length > 0 && data.some(d => lines.some(l => (d[l.key] ?? 0) > 0))

  return (
    <div className="hive-chart">
      {title && <h2 className="hive-section-title mb-5">{title}</h2>}
      {!hasData ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          No tap data for this period
        </div>
      ) : null}
      {hasData && <ResponsiveContainer width="100%" height={260}>
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
              background: isDark ? '#242b24' : '#fdfcf8',
              border: `1px solid ${isDark ? '#ffffff24' : '#e3e1d7'}`,
              borderRadius: '14px',
              fontSize: '12px',
              color: isDark ? '#f5f3e9' : '#242820',
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
              strokeWidth={3}
              isAnimationActive={!reducedMotion}
              animationDuration={650}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>}
    </div>
  )
}
