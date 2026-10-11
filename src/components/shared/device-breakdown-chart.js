'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import useReducedMotion from './use-reduced-motion'

export default function DeviceBreakdownChart({ mobile = 0, desktop = 0, tablet = 0, unknown = 0, loading, isDark }) {
  const reducedMotion = useReducedMotion()
  if (loading) {
    return (
      <div className="hive-chart">
        <div className="h-[240px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    )
  }

  const total = mobile + desktop + tablet + unknown
  const data = [
    { name: 'Mobile', value: mobile },
    { name: 'Desktop', value: desktop },
    { name: 'Tablet', value: tablet },
    { name: 'Unknown', value: unknown },
  ]
  const colors = ['#e1b640', '#8e987b', '#c6ad7e', '#797e70']

  if (total === 0) {
    return (
      <div className="hive-chart flex flex-col">
        <h2 className="hive-section-title mb-2">Device breakdown</h2>
        <div className="flex-1 flex items-center justify-center h-[220px] text-sm text-gray-400 dark:text-gray-500">
          No data yet
        </div>
      </div>
    )
  }

  return (
    <div className="hive-chart">
      <h2 className="hive-section-title mb-2">Device breakdown</h2>
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
              cornerRadius={6}
              paddingAngle={3}
              stroke="none"
              isAnimationActive={!reducedMotion}
              animationDuration={650}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: isDark ? '#242b24' : '#fdfcf8',
                border: `1px solid ${isDark ? '#ffffff24' : '#e3e1d7'}`,
                borderRadius: '14px',
                fontSize: '12px',
                color: isDark ? '#f5f3e9' : '#242820',
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
