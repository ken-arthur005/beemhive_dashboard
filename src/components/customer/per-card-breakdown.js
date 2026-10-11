'use client'

import { CreditCard, MonitorSmartphone, Disc } from 'lucide-react'

const TYPE_CONFIG = {
  card:      { icon: CreditCard,        label: 'NFC Card' },
  stand:     { icon: MonitorSmartphone, label: 'NFC Stand' },
  round_tag: { icon: Disc,              label: 'NFC Round Tag' },
}

export default function PerCardBreakdown({ cards, period }) {
  const totals = cards.map(card => card.periodTapCount ?? 0)
  const grandTotal = totals.reduce((s, n) => s + n, 0)

  return (
    <div className="hive-panel hive-panel-pad">
      <div className="flex items-center justify-between mb-4">
        <h2 className="hive-section-title">Performance by card</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">{period}</span>
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
                {card.slug ? `/t/${card.slug}` : 'Retired item'}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 tabular-nums w-10 text-right shrink-0">
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
