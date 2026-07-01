'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, Plus, Copy, Check, MoreHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import CreateNfcItemModal from '@/components/admin/create-nfc-item-modal'

const PAGE_SIZE = 10

const PRODUCT_LABELS = { card: 'Card', stand: 'Stand', round_tag: 'Round Tag' }
const PRODUCT_BADGE_CLASSES = {
  card: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  stand: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  round_tag: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

let toastTimer = null

export default function NfcItemsTable() {
  const supabase = createClient()

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef(null)

  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

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
        const res = await fetch('/api/admin/nfc-items', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load')
        setItems(data)
      } catch (e) {
        setFetchError(e.message)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filteredItems = useMemo(() => {
    let result = items
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(i =>
        (i.ownerEmail ?? '').toLowerCase().includes(q) ||
        i.slug.toLowerCase().includes(q)
      )
    }
    if (filterType !== 'all') result = result.filter(i => i.product_type === filterType)
    if (filterStatus !== 'all') result = result.filter(i => filterStatus === 'active' ? i.is_active : !i.is_active)
    return result
  }, [items, debouncedSearch, filterType, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const pagedItems = useMemo(() => filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredItems, page])

  useEffect(() => { setPage(1) }, [debouncedSearch, filterType, filterStatus])

  function handleToggle(item) {
    const prev = items
    setItems(items.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
    supabase.from('nfc_items').update({ is_active: !item.is_active }).eq('id', item.id)
      .then(({ error }) => {
        if (error) { setItems(prev); showToast('Failed to update status', 'error') }
      })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    const prev = items
    setItems(items.filter(i => i.id !== target.id))
    setDeleteTarget(null)
    supabase.from('nfc_items').delete().eq('id', target.id)
      .then(({ error }) => {
        if (error) { setItems(prev); showToast('Failed to delete item', 'error') }
      })
  }

  function handleCreated(newItem) {
    setItems(prev => [newItem, ...prev])
    setIsModalOpen(false)
    showToast(`NFC item created — invite sent to ${newItem.ownerEmail}`, 'success')
  }

  async function handleResendInvite(item) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ mode: 'resend', email: item.ownerEmail }),
    })
    if (res.ok) showToast(`Invite resent to ${item.ownerEmail}`, 'success')
    else showToast('Failed to resend invite', 'error')
  }

  function copySlugUrl(item) {
    navigator.clipboard.writeText(`https://beemhive.com/t/${item.slug}`)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function copyItemUrl(item) {
    navigator.clipboard.writeText(`https://beemhive.com/t/${item.slug}`)
    showToast('URL copied to clipboard', 'success')
  }

  const hasFilters = debouncedSearch || filterType !== 'all' || filterStatus !== 'all'

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">NFC Items</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Manage your NFC products and customer assignments
          </p>
        </div>
        <div
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-3 py-2 text-sm font-semibold text-white transition-colors cursor-pointer select-none shrink-0"
        >
          <Plus size={16} />
          Create NFC Item
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
              placeholder="Search by customer or slug…"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Product type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="stand">Stand</SelectItem>
              <SelectItem value="round_tag">Round Tag</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {!isLoading && `Showing ${filteredItems.length} of ${items.length} items`}
          </span>
        </div>

        {/* Table */}
        {fetchError ? (
          <div className="px-4 py-12 text-center text-sm text-rose-500">{fetchError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {['Product', 'Customer', 'Slug', 'Status', 'Taps', 'Created', ''].map(h => (
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
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pagedItems.length === 0 ? null : (
                  pagedItems.map(item => (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      {/* Product badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRODUCT_BADGE_CLASSES[item.product_type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {PRODUCT_LABELS[item.product_type] ?? item.product_type}
                        </span>
                      </td>
                      {/* Customer */}
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                        {item.ownerEmail ?? <span className="text-gray-400">—</span>}
                      </td>
                      {/* Slug */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs text-gray-700 dark:text-gray-300 font-mono">{item.slug}</code>
                          <button
                            onClick={() => copySlugUrl(item)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            title="Copy URL"
                          >
                            {copiedId === item.id
                              ? <Check size={13} className="text-emerald-600" />
                              : <Copy size={13} />
                            }
                          </button>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={() => handleToggle(item)}
                        />
                      </td>
                      {/* Taps */}
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 tabular-nums">
                        {item.tapCount}
                      </td>
                      {/* Created */}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" />
                            }
                          >
                            <MoreHorizontal size={16} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyItemUrl(item)}>
                              Copy URL
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResendInvite(item)}>
                              Resend invite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggle(item)}>
                              {item.is_active ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(item)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Empty states */}
            {!isLoading && pagedItems.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                {hasFilters ? (
                  <>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No items match your search</p>
                    <button
                      onClick={() => { setSearch(''); setDebouncedSearch(''); setFilterType('all'); setFilterStatus('all') }}
                      className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-3xl">📇</span>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No NFC items yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Create your first NFC item to get started</p>
                    <div
                      onClick={() => setIsModalOpen(true)}
                      className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors cursor-pointer select-none"
                    >
                      <Plus size={16} />
                      Create NFC Item
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && filteredItems.length > PAGE_SIZE && (
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NFC item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the NFC item and all its tap history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-rose-600 hover:bg-rose-700 text-white border-transparent"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create modal */}
      <CreateNfcItemModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCreated={handleCreated}
      />

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
