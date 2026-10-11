'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export default function StatCard({ icon: Icon, value, label, trend, tooltip, loading }) {
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend)
  const Label = tooltip ? <Tooltip><TooltipTrigger render={<span tabIndex={0} className="underline decoration-dashed underline-offset-4" />}>{label}</TooltipTrigger><TooltipContent>{tooltip}</TooltipContent></Tooltip> : <span>{label}</span>
  return <div className="hive-stat" data-reveal aria-busy={loading}>
    <div className="hive-stat-label">{Icon && <Icon size={16} strokeWidth={1.5} aria-hidden="true" />}{Label}</div>
    {loading ? <div className="hive-skeleton h-10 w-24 mt-5 mb-3" /> : <p className="hive-stat-value">{value ?? '—'}</p>}
    {hasTrend && !loading && <span className={`hive-stat-trend ${trend >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(Math.round(trend))}% <span className="text-muted-foreground font-normal ml-1">vs previous period</span></span>}
  </div>
}
