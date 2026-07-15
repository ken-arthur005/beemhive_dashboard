'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export default function StatCard({ icon: Icon, value, label, trend, tooltip, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-7 w-24 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-4 w-32 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    )
  }

  const hasTrend = typeof trend === 'number' && isFinite(trend)
  const trendUp = hasTrend && trend >= 0

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-2">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
          <Icon size={16} className="text-amber-600 dark:text-amber-400" />
        </div>
      )}
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums leading-none mt-1">
        {value}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-gray-500 dark:text-gray-400 cursor-default underline decoration-dashed underline-offset-2">
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        )}
        {hasTrend && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-xs font-medium rounded-full px-1.5 py-0.5',
            trendUp
              ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40'
              : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/40'
          )}>
            {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(Math.round(trend))}%
          </span>
        )}
      </div>
    </div>
  )
}
