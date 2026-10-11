'use client'

import { Button } from '@/components/ui/button'

export const inputClass = 'hive-input'
export const cellClass = 'px-4 py-3 text-left whitespace-nowrap'
export const cardClass = 'hive-panel overflow-hidden'
export const primaryClass = 'bg-amber-500 hover:bg-amber-600 text-gray-900'

export function Notice({ error, message }) {
  if (!error && !message) return null
  return <p role={error ? 'alert' : 'status'} className={`text-sm break-words ${error ? 'text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-300'}`}>{error || message}</p>
}

export function ListState({ list, noun }) {
  if (list.loading) return <p role="status" className="p-8 text-center text-sm text-gray-500">Loading {noun}…</p>
  if (list.error) return <div className="space-y-3 p-8 text-center"><Notice error={list.error} /><Button variant="outline" onClick={list.reload}>Retry loading {noun}</Button></div>
  if (!list.rows.length) return <p className="p-8 text-center text-sm text-gray-500">No {noun} match these filters.</p>
  return null
}

export function Pagination({ list, onPage }) {
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize))
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-800 px-4 py-3 text-xs text-gray-500">
    <span>{list.loading ? 'Loading…' : `Page ${list.page} of ${pages} · ${list.total} results`}</span>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={list.loading || list.page <= 1} onClick={() => onPage(list.page - 1)}>Previous</Button>
      <Button variant="outline" size="sm" disabled={list.loading || list.page >= pages} onClick={() => onPage(list.page + 1)}>Next</Button>
    </div>
  </div>
}

export function formatDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}
