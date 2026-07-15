'use client'

import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Check, X } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export default function SortableLinkItem({ link, linkTypes, onUpdate, onDelete, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const [urlError, setUrlError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const confirmTimerRef = useRef(null)

  const currentType = linkTypes.find(t => t.value === link.type) ?? linkTypes[0]
  const Icon = currentType.Icon

  function handleTypeChange(newType) {
    onUpdate(link.id, { type: newType, url: '' })
    setUrlError(null)
  }

  function handleUrlChange(e) {
    onUpdate(link.id, { url: e.target.value })
    setUrlError(null)
  }

  function handleUrlBlur() {
    if (link.url && !currentType.validate(link.url)) {
      setUrlError(`Invalid ${currentType.label} URL`)
    }
  }

  function handleDeleteClick() {
    if (confirming) return
    setConfirming(true)
    confirmTimerRef.current = setTimeout(() => setConfirming(false), 2000)
  }

  function handleConfirmDelete() {
    clearTimeout(confirmTimerRef.current)
    setConfirming(false)
    onDelete(link.id)
  }

  function handleCancelDelete() {
    clearTimeout(confirmTimerRef.current)
    setConfirming(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 transition-shadow
        ${isDragging ? 'shadow-lg scale-[1.02] z-10 relative' : ''}
      `}
    >
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="cursor-grab active:cursor-grabbing p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none shrink-0 disabled:cursor-default"
          tabIndex={-1}
        >
          <GripVertical size={16} />
        </button>

        {/* Type icon */}
        <Icon size={16} className="text-gray-400 shrink-0" />

        {/* Type dropdown */}
        <Select value={link.type} onValueChange={handleTypeChange} disabled={disabled}>
          <SelectTrigger className="w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {linkTypes.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* URL input */}
        <input
          type="text"
          value={link.url}
          onChange={handleUrlChange}
          onBlur={handleUrlBlur}
          onFocus={() => setUrlError(null)}
          placeholder={currentType.placeholder}
          maxLength={500}
          disabled={disabled}
          className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
        />

        {/* Delete button */}
        {confirming ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleConfirmDelete}
              className="p-1 rounded text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              title="Confirm delete"
            >
              <Check size={15} />
            </button>
            <button
              onClick={handleCancelDelete}
              className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Cancel"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleDeleteClick}
            disabled={disabled}
            className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors shrink-0 disabled:opacity-40"
            title="Delete link"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {urlError && (
        <p className="text-xs text-rose-500 pl-7">{urlError}</p>
      )}
    </div>
  )
}
