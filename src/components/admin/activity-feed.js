'use client'

import { MousePointerClick } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'

export default function ActivityFeed({ activity, loading }) {
  return (
    <div className="hive-panel hive-panel-pad">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="hive-section-title">Recent activity</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">Latest events in this period</span>
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
                <MousePointerClick size={17} strokeWidth={1.5} className="text-muted-foreground shrink-0" />

                {/* Slug + email */}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
                    /t/{tap.slug ?? '—'}
                  </p>
                  {tap.owner_email && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{tap.owner_email}</p>
                  )}
                  <p className="text-xs text-gray-500">{tap.event_type === 'contact_download' ? 'Contact download' : 'Profile view'}</p>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {tap.created_at && Number.isFinite(Date.parse(tap.created_at)) ? formatRelativeTime(tap.created_at) : 'Time unavailable'}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs py-0 border-transparent ${
                      isMobile
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {isMobile ? 'Mobile' : tap.device_type === 'desktop' ? 'Desktop' : tap.device_type || 'Unknown device'}
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
