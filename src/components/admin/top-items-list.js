'use client'

import { Badge } from '@/components/ui/badge'

const TYPE_LABELS = {
  card: 'Card',
  stand: 'Stand',
  round_tag: 'Round Tag',
}

export default function TopItemsList({ items, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Top NFC items</p>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-2.5 w-48 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </div>
              <div className="h-3.5 w-8 rounded bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const topCount = items[0]?.tap_count ?? 0

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Top NFC items</p>
        <span className="text-xs text-gray-400 dark:text-gray-500">All time</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">No tap data yet</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((item, i) => {
            const pct = topCount > 0 ? (item.tap_count / topCount) * 100 : 0
            return (
              <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                {/* Rank */}
                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 font-medium shrink-0">
                  {i + 1}
                </div>

                {/* Slug + type + email */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
                      /t/{item.slug}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 shrink-0 py-0"
                    >
                      {TYPE_LABELS[item.product_type] ?? item.product_type}
                    </Badge>
                  </div>
                  {item.owner_email && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.owner_email}</p>
                  )}
                  {/* Progress bar */}
                  <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Tap count */}
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums shrink-0">
                  {(item.tap_count ?? 0).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
