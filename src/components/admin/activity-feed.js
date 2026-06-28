'use client'

import { useEffect, useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'

export default function ActivityFeed({ activity, loading, onRefresh }) {
  const [lastUpdated, setLastUpdated] = useState(null)

  // Track when activity prop changes to update "last updated" timestamp
  useEffect(() => {
    if (!loading) setLastUpdated(Date.now())
  }, [activity, loading])

  // Poll every 60s
  useEffect(() => {
    const id = setInterval(() => {
      onRefresh()
    }, 60000)
    return () => clearInterval(id)
  }, [onRefresh])

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent activity</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {formatRelativeTime(new Date(lastUpdated).toISOString())}
            </span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">Last 20 tap events</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </div>
              <div className="h-3.5 w-16 rounded bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">No tap events yet</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {activity.map(tap => {
            const isMobile = tap.device_type === 'mobile'
            return (
              <div key={tap.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                {/* Icon */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0
                  ${isMobile
                    ? 'bg-emerald-50 dark:bg-emerald-950/40'
                    : 'bg-blue-50 dark:bg-blue-950/40'
                  }`}
                >
                  <MousePointerClick
                    size={13}
                    className={isMobile
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-blue-600 dark:text-blue-400'
                    }
                  />
                </div>

                {/* Slug + email */}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
                    /t/{tap.slug ?? '—'}
                  </p>
                  {tap.owner_email && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{tap.owner_email}</p>
                  )}
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {formatRelativeTime(tap.created_at)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs py-0 border-transparent ${
                      isMobile
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                    }`}
                  >
                    {isMobile ? 'Mobile' : 'Desktop'}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
