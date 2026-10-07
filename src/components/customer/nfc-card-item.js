'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  CreditCard, MonitorSmartphone, Disc,
  Copy, Check, MousePointerClick, Zap, Clock,
  ExternalLink, Smartphone, ChevronDown, ChevronUp, Download,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatRelativeTime } from '@/lib/utils'
import { itemUrl } from '@/lib/platform'

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

export default function NfcCardItem({ item, account }) {
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedInstruction, setCopiedInstruction] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const profileUrl = item.url || itemUrl(item.slug)
  const enabled = !item.retired_at && (item.status === 'enabled' || item.status === 'active' || item.is_active === true)
  const publiclyAvailable = enabled && account?.status === 'active' && Boolean(account.setup_completed_at) && account.published_revision != null
  const totalTaps = item.tapCount ?? item.totalTaps ?? 0
  const tapsToday = item.today ?? 0
  const lastTap = item.lastTap
    ? `Last tap: ${formatRelativeTime(item.lastTap)}`
    : 'No taps yet'

  async function downloadQr() {
    setIsDownloading(true)
    try {
      const response = await fetch(`/api/qr?slug=${encodeURIComponent(item.slug)}`, { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error('Could not download your QR code. Please try again.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `beem-hive-${item.slug}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) { toast.error(failure.message) }
    finally { setIsDownloading(false) }
  }

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
          className={enabled
            ? 'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }
        >
          {item.retired_at ? 'Retired' : enabled ? 'Item enabled' : 'Item paused'}
        </Badge>
      </div>

      {/* Inactive warning */}
      {!publiclyAvailable && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          {enabled ? 'This item is enabled, but your profile is not public. Complete account setup and publish your draft to make it available.' : 'This item is paused or retired. Contact Beem Hive to check its availability.'} You can prepare its QR code before publication.
        </div>
      )}
      {publiclyAvailable && <p className="text-xs text-amber-700 dark:text-amber-400">Public · published revision {account.published_revision}</p>}

      {/* Profile URL */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`nfc-url-${item.id}`} className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Your profile URL
        </label>
        <div className="relative flex items-center">
          <input
            id={`nfc-url-${item.id}`}
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
              ? <Check size={14} className="text-amber-600" />
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
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={profileUrl} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink size={14} />
          {publiclyAvailable ? 'View published profile' : 'Check public URL'}
        </Button>
        <Button variant="outline" size="sm" disabled={isDownloading} onClick={downloadQr}><Download size={14} />{isDownloading ? 'Downloading…' : 'Download QR'}</Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          aria-controls={`nfc-instructions-${item.id}`}
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
      <div id={`nfc-instructions-${item.id}`} hidden={!isExpanded}>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            How to program your NFC card
          </p>
          <ol className="flex flex-col gap-2 text-sm text-amber-900 dark:text-amber-200">
            <li className="flex gap-2">
              <span className="shrink-0 font-medium">1.</span>
              Download &quot;NFC Tools&quot; — free on iOS and Android
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium">2.</span>
              Open NFC Tools → tap &quot;Write&quot; → tap &quot;Add a record&quot; → select &quot;URL/URI&quot;
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
                    ? <Check size={13} className="text-amber-600" />
                    : <Copy size={13} />
                  }
                </button>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium">4.</span>
              Tap &quot;Write / XX bytes&quot; then hold your phone against your NFC card
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium">5.</span>
              Your card is programmed. It opens your profile once setup is complete, a revision is published, and the item is enabled.
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
