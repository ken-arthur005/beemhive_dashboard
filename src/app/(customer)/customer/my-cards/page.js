'use client'

import { useState, useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from('nfc_items')
        .select('*, tap_events(created_at)')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })

      setItems(data ?? [])
      setIsLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">My Cards</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Your NFC products and profile links
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
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <CreditCard size={80} className="text-gray-300 dark:text-gray-700" />
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">No cards yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
            Your NFC cards will appear here once they've been set up by Beem Hive.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map(item => (
            <NfcCardItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
