'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import useReducedMotion from '@/components/shared/use-reduced-motion'

function formatHour(h) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

export default function TapsByHourChart({ data, loading, isDark }) {
  const reducedMotion = useReducedMotion()
  if (loading) {
    return (
      <div className="hive-chart">
        <div className="h-[240px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    )
  }

  const currentHour = new Date().getUTCHours()
  const axisColor = isDark ? '#aaa99d' : '#737269'
  const gridColor = isDark ? '#ffffff0c' : '#eae7dc'

  return (
    <div className="hive-chart">
      <h2 className="hive-section-title mb-5">Views by time of day <span className="text-xs text-muted-foreground">· UTC</span></h2>
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
              background: isDark ? '#242b24' : '#fdfcf8',
              border: `1px solid ${isDark ? '#ffffff24' : '#e3e1d7'}`,
              borderRadius: '14px',
              fontSize: '12px',
              color: isDark ? '#f5f3e9' : '#242820',
            }}
            formatter={(value, _, props) => [`${value} taps`, `at ${formatHour(props.payload.hour)}`]}
            labelFormatter={() => ''}
          />
          <Bar dataKey="count" radius={[7, 7, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={650}>
            {data.map((entry) => (
              <Cell
                key={entry.hour}
                fill={entry.hour === currentHour ? '#f3c442' : '#8e987b'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
