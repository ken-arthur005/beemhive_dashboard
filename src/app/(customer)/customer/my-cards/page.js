'use client'

import { useState, useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import { customerRequest, useCustomerProfile } from '@/components/customer/customer-profile-context'
import { Skeleton } from '@/components/ui/skeleton'
import NfcCardItem from '@/components/customer/nfc-card-item'

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-px w-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
      </div>
    </div>
  )
}

export default function MyCardsPage() {
  const { account } = useCustomerProfile()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function load() {
      try {
        const data = await customerRequest('/api/customer/items', { signal: controller.signal })
        if (!cancelled) { setItems(data.items); setError(null) }
      } catch (failure) { if (!cancelled) setError(failure.message) }
      finally { if (!cancelled) setIsLoading(false) }
    }
    load()
    return () => { cancelled = true; controller.abort() }
  }, [attempt])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4" data-reveal>
        <div>
          <p className="hive-eyebrow mb-3">Small objects. Lasting connections.</p><h1 className="hive-page-title">My Cards</h1>
          <p className="hive-page-subtitle">
            Your collection, ready for the next introduction.
          </p>
        </div>
        <div className="shrink-0 mt-0.5">
          {isLoading ? (
            <Skeleton className="h-6 w-16 rounded-full" />
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              {items.length} {items.length === 1 ? 'card' : 'cards'}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {error ? <div role="alert" className="text-sm text-rose-600"><p>{error}</p><button className="mt-2 underline" onClick={() => { setIsLoading(true); setAttempt(value => value + 1) }}>Try again</button></div> : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <CreditCard size={80} className="text-gray-300 dark:text-gray-700" />
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">No cards yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
            Your NFC cards will appear here once they&apos;ve been set up by Beem Hive.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map(item => (
            <NfcCardItem key={item.id} item={item} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}
