'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, MoreHorizontal, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE = 10

function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

function deriveStatus(customer) {
  if (!customer.email_confirmed_at) return 'invited'
  return 'active'
}

let toastTimer = null

export default function CustomersTable() {
  const supabase = createClient()

  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef(null)

  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [toast, setToast] = useState(null)
  const [copiedSlug, setCopiedSlug] = useState(null)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => setToast(null), 3000)
  }

  const handleSearch = useCallback((e) => {
    const val = e.target.value
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const res = await fetch('/api/admin/customers', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load')
        setCustomers(data)
      } catch (e) {
        setFetchError(e.message)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filteredAndSorted = useMemo(() => {
    let result = customers

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(c =>
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      )
    }

    if (filterStatus !== 'all') {
      result = result.filter(c => deriveStatus(c) === filterStatus)
    }

    if (sortBy === 'oldest') {
      result = [...result].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => {
        const na = (a.name ?? a.email ?? '').toLowerCase()
        const nb = (b.name ?? b.email ?? '').toLowerCase()
        return na.localeCompare(nb)
      })
    } else if (sortBy === 'nfc_count') {
      result = [...result].sort((a, b) => b.nfc_item_count - a.nfc_item_count)
    }
    // 'newest' is default order from API — no re-sort needed

    return result
  }, [customers, debouncedSearch, filterStatus, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE))
  const pagedCustomers = useMemo(
    () => filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredAndSorted, page]
  )

  useEffect(() => { setPage(1) }, [debouncedSearch, filterStatus, sortBy])

  function toggleExpand(userId) {
    setExpandedId(prev => prev === userId ? null : userId)
  }

  async function handleResendInvite(customer) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ mode: 'resend', email: customer.email }),
    })
    if (res.ok) showToast(`Invite resent to ${customer.email}`, 'success')
    else showToast('Failed to resend invite', 'error')
  }

  function copySlug(slug) {
    navigator.clipboard.writeText(`https://beemhive.com/t/${slug}`)
    setCopiedSlug(slug)
    showToast('URL copied to clipboard', 'success')
    setTimeout(() => setCopiedSlug(null), 1500)
  }

  const hasFilters = debouncedSearch || filterStatus !== 'all'

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Customers</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            All registered customers and their account status
          </p>
        </div>
        <div className="shrink-0">
          {isLoading ? (
            <Skeleton className="h-7 w-28 rounded-full" />
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400 rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-1">
              {customers.length} customers total
            </span>
          )}
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={handleSearch}
              placeholder="Search customers…"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="active">Active</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name">Name A→Z</SelectItem>
              <SelectItem value="nfc_count">Most NFC items</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {!isLoading && `Showing ${filteredAndSorted.length} of ${customers.length} customers`}
          </span>
        </div>

        {/* Table */}
        {fetchError ? (
          <div className="px-4 py-12 text-center text-sm text-rose-500">Something went wrong. Please refresh the page.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {['Customer', 'NFC Items', 'Account Status', 'Last Login', 'Joined', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pagedCustomers.length === 0 ? null : (
                  pagedCustomers.map(customer => {
                    const status = deriveStatus(customer)
                    const isExpanded = expandedId === customer.user_id
                    const displayName = customer.name || customer.email

                    return (
                      <>
                        <tr
                          key={customer.user_id}
                          onClick={() => toggleExpand(customer.user_id)}
                          className="border-b border-gray-100 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                        >
                          {/* Customer */}
                          <td className="px-4 py-3 max-w-[220px]">
                            <div className="flex items-center gap-2">
                              {/* Avatar */}
                              <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 shrink-0 overflow-hidden">
                                {customer.photo_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={customer.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (customer.name?.[0] ?? customer.email?.[0] ?? '?').toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {displayName}
                                </p>
                                {customer.name ? (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{customer.email}</p>
                                ) : (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">Profile not set up</p>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* NFC Items */}
                          <td className="px-4 py-3 tabular-nums">
                            {customer.nfc_item_count === 0
                              ? <span className="text-gray-400 dark:text-gray-500">—</span>
                              : <span className="text-gray-700 dark:text-gray-300">{customer.nfc_item_count}</span>
                            }
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            {status === 'invited' ? (
                              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent">
                                Invited
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent">
                                Active
                              </Badge>
                            )}
                          </td>
                          {/* Last login */}
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                            {customer.last_sign_in_at ? formatRelativeTime(customer.last_sign_in_at) : 'Never logged in'}
                          </td>
                          {/* Joined */}
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                            {formatDate(customer.created_at)}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" />
                                }
                              >
                                <MoreHorizontal size={16} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => toggleExpand(customer.user_id)}>
                                  View profile
                                </DropdownMenuItem>
                                {status === 'invited' && (
                                  <DropdownMenuItem onClick={() => handleResendInvite(customer)}>
                                    Resend invite
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {customer.nfc_items.length === 0 ? (
                                  <DropdownMenuItem disabled>
                                    No profile URL yet
                                  </DropdownMenuItem>
                                ) : customer.nfc_items.length === 1 ? (
                                  <DropdownMenuItem onClick={() => copySlug(customer.nfc_items[0].slug)}>
                                    Copy profile URL
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      Copy profile URL
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {customer.nfc_items.map(item => (
                                        <DropdownMenuItem key={item.slug} onClick={() => copySlug(item.slug)}>
                                          <span className="capitalize text-gray-500 dark:text-gray-400 mr-1.5">{item.product_type.replace('_', ' ')}</span>
                                          <span className="font-mono text-xs">/t/{item.slug}</span>
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>

                        {/* Inline expand panel */}
                        {isExpanded && (
                          <tr key={`${customer.user_id}-detail`} className="border-b border-gray-100 dark:border-gray-800/60">
                            <td colSpan={6} className="px-0 py-0">
                              <div className="transition-all duration-200 overflow-hidden">
                                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                                  <div className="flex gap-4">
                                    {/* Profile photo */}
                                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl font-medium text-gray-600 dark:text-gray-300 shrink-0 overflow-hidden">
                                      {customer.photo_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={customer.photo_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        (customer.name?.[0] ?? customer.email?.[0] ?? '?').toUpperCase()
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                      {customer.name ? (
                                        <>
                                          <p className="font-semibold text-gray-900 dark:text-gray-100">{customer.name}</p>
                                          {customer.title && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{customer.title}</p>
                                          )}
                                          {customer.bio && (
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{customer.bio}</p>
                                          )}
                                        </>
                                      ) : (
                                        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No profile set up yet</p>
                                      )}

                                      {/* NFC item chips */}
                                      {customer.nfc_items.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                          {customer.nfc_items.map(item => (
                                            <button
                                              key={item.slug}
                                              onClick={() => copySlug(item.slug)}
                                              className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            >
                                              <span className="capitalize">{item.product_type.replace('_', ' ')}</span>
                                              <span className="font-mono text-gray-400">— /t/{item.slug}</span>
                                              {copiedSlug === item.slug
                                                ? <Check size={11} className="text-emerald-600" />
                                                : <Copy size={11} className="text-gray-400" />
                                              }
                                            </button>
                                          ))}
                                        </div>
                                      )}

                                      {/* Resend invite */}
                                      {deriveStatus(customer) === 'invited' && (
                                        <div className="mt-2">
                                          <button
                                            onClick={() => handleResendInvite(customer)}
                                            className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
                                          >
                                            Resend invite
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>

            {/* Empty states */}
            {!isLoading && pagedCustomers.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                {hasFilters ? (
                  <>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No customers match your search</p>
                    <button
                      onClick={() => { setSearch(''); setDebouncedSearch(''); setFilterStatus('all') }}
                      className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No customers yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customers are added when you create an NFC item</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && filteredAndSorted.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-opacity
            ${toast.type === 'error' ? 'bg-rose-600' : 'bg-gray-900 dark:bg-gray-700'}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
