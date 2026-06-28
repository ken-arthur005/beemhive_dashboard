'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  CreditCard, MonitorSmartphone, Disc,
  Copy, Check, MousePointerClick, Zap, Clock,
  ExternalLink, Smartphone, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatRelativeTime } from '@/lib/utils'

const TYPE_CONFIG = {
  card:      { icon: CreditCard,        label: 'NFC Card' },
  stand:     { icon: MonitorSmartphone, label: 'NFC Stand' },
  round_tag: { icon: Disc,              label: 'NFC Round Tag' },
}

async function copyToClipboard(text, setCopied) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  setCopied(true)
  toast.success('Copied to clipboard')
  setTimeout(() => setCopied(false), 1500)
}

export default function NfcCardItem({ item }) {
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedInstruction, setCopiedInstruction] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const profileUrl = `https://beemhive.com/t/${item.slug}`

  const totalTaps = item.tap_events?.length ?? 0
  const todayStr = new Date().toISOString().slice(0, 10)
  const tapsToday = item.tap_events?.filter(e => e.created_at.startsWith(todayStr)).length ?? 0
  const sortedTaps = item.tap_events?.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))
  const lastTap = sortedTaps?.length
    ? `Last tap: ${formatRelativeTime(sortedTaps[0].created_at)}`
    : 'No taps yet'

  const { icon: TypeIcon, label: typeLabel } = TYPE_CONFIG[item.product_type] ?? { icon: CreditCard, label: item.product_type }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <TypeIcon size={18} className="shrink-0" />
          <span className="text-sm font-semibold">{typeLabel}</span>
        </div>
        <Badge
          variant="outline"
          className={item.is_active
            ? 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }
        >
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Inactive warning */}
      {!item.is_active && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          This card is currently inactive. Your profile page will not be accessible until it is reactivated by Beem Hive.
        </div>
      )}

      {/* Profile URL */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Your profile URL
        </p>
        <div className="relative flex items-center">
          <input
            readOnly
            value={profileUrl}
            className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 border-0 px-3 py-2 pr-9 text-sm text-gray-700 dark:text-gray-300 font-mono focus:outline-none select-all"
          />
          <button
            onClick={() => copyToClipboard(profileUrl, setCopiedUrl)}
            className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Copy URL"
          >
            {copiedUrl
              ? <Check size={14} className="text-emerald-600" />
              : <Copy size={14} />
            }
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Write this URL to your NFC card using NFC Tools
        </p>
      </div>

      <Separator />

      {/* Tap stats */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <MousePointerClick size={14} className="shrink-0" />
          {totalTaps} total taps
        </span>
        <span className="flex items-center gap-1.5">
          <Zap size={14} className="shrink-0" />
          {tapsToday} taps today
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={14} className="shrink-0" />
          {lastTap}
        </span>
      </div>

      <Separator />

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
            <ExternalLink size={14} />
            View Profile
          </a>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(prev => !prev)}
          className="flex items-center gap-1.5"
        >
          <Smartphone size={14} />
          NFC Setup
          {isExpanded
            ? <ChevronUp size={14} className="ml-auto" />
            : <ChevronDown size={14} className="ml-auto" />
          }
        </Button>
      </div>

      {/* NFC instructions accordion */}
      <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-[500px]' : 'max-h-0'}`}>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            How to program your NFC card
          </p>
          <ol className="flex flex-col gap-2 text-sm text-amber-900 dark:text-amber-200">
            <li className="flex gap-2">
              <span className="shrink-0 font-medium">1.</span>
              Download "NFC Tools" — free on iOS and Android
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium">2.</span>
              Open NFC Tools → tap "Write" → tap "Add a record" → select "URL/URI"
            </li>
            <li className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <span className="shrink-0 font-medium">3.</span>
                Paste your profile URL:
              </div>
              <div className="relative flex items-center ml-4">
                <code className="w-full rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 px-3 py-1.5 pr-9 text-xs font-mono text-amber-900 dark:text-amber-200 break-all">
                  {profileUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(profileUrl, setCopiedInstruction)}
                  className="absolute right-2 text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
                  title="Copy URL"
                >
                  {copiedInstruction
                    ? <Check size={13} className="text-emerald-600" />
                    : <Copy size={13} />
                  }
                </button>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium">4.</span>
              Tap "Write / XX bytes" then hold your phone against your NFC card
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium">5.</span>
              Done — your card now opens your Beem Hive profile when tapped
            </li>
          </ol>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            You only need to do this once per card.
          </p>
        </div>
      </div>
    </div>
  )
}
