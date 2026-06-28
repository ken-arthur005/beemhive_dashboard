'use client'

import { CreditCard, MonitorSmartphone, Disc } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const TYPE_CONFIG = {
  card:      { icon: CreditCard,        label: 'NFC Card' },
  stand:     { icon: MonitorSmartphone, label: 'NFC Stand' },
  round_tag: { icon: Disc,              label: 'NFC Round Tag' },
}

export default function PerCardBreakdown({ cards }) {
  const totals = cards.map(c => c.tap_events?.[0]?.count ?? 0)
  const grandTotal = totals.reduce((s, n) => s + n, 0)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Performance by card</p>
        <span className="text-xs text-gray-400 dark:text-gray-500">All time</span>
      </div>
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {cards.map((card, i) => {
          const count = totals[i]
          const pct = grandTotal > 0 ? (count / grandTotal) * 100 : 0
          const { icon: TypeIcon } = TYPE_CONFIG[card.product_type] ?? { icon: CreditCard }

          return (
            <div key={card.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <TypeIcon size={15} className="shrink-0 text-gray-400 dark:text-gray-500" />
              <span className="font-mono text-xs text-gray-600 dark:text-gray-400 shrink-0 w-28 truncate">
                /t/{card.slug}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 tabular-nums w-10 text-right shrink-0">
                {count}
              </span>
              <Badge
                variant="outline"
                className={card.is_active
                  ? 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs shrink-0'
                  : 'border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-xs shrink-0'
                }
              >
                {card.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
