'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'

export default function SortableLinkItem({ link, linkTypes, onUpdate, onDelete, disabled }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: link.id, disabled })
  const [urlError, setUrlError] = useState(null)
  const currentType = linkTypes.find(type => type.value === link.type) ?? linkTypes[0]
  const Icon = currentType.Icon
  const inputId = `link-url-${link.id}`
  const typeId = `link-type-${link.id}`

  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`border-b border-border py-4 ${isDragging ? 'z-10 relative shadow-lg bg-card rounded-xl p-3' : ''}`}>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={disabled} tabIndex={0}
        aria-label={`Reorder ${currentType.label} link. Press Space to pick up, arrow keys to move, Space to drop.`}
        className="min-h-9 min-w-9 flex items-center justify-center cursor-grab touch-none text-gray-500 focus-visible:outline-2 focus-visible:outline-amber-500"><GripVertical size={16} /></button>
      <Icon size={16} aria-hidden="true" className="text-gray-400" />
      <label htmlFor={typeId} className="sr-only">Link type</label>
      <select id={typeId} value={link.type} disabled={disabled} onChange={event => { onUpdate(link.id, { type: event.target.value, url: '' }); setUrlError(null) }}
        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-sm focus:outline-amber-500">
        {linkTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
      </select>
      <button type="button" disabled={disabled} aria-label={`Remove ${currentType.label} link`} onClick={() => onDelete(link.id)}
        className="ml-auto min-h-9 min-w-9 flex items-center justify-center text-gray-500 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-amber-500"><Trash2 size={15} /></button>
      <div className="w-full sm:flex-1 sm:min-w-40">
        <label htmlFor={inputId} className="sr-only">{currentType.label} {link.type === 'phone' ? 'number' : link.type === 'email' ? 'address' : 'URL'}</label>
        <input id={inputId} type={link.type === 'phone' ? 'tel' : link.type === 'email' ? 'email' : 'text'} value={link.url}
          onChange={event => { onUpdate(link.id, { url: event.target.value }); setUrlError(null) }}
          onBlur={() => { if (link.url && !currentType.validate(link.url)) setUrlError(`Enter a valid ${currentType.label.toLowerCase()} ${link.type === 'phone' ? 'number' : link.type === 'email' ? 'address' : 'URL'}.`) }}
          placeholder={currentType.placeholder} maxLength={500} disabled={disabled} aria-invalid={Boolean(urlError)} aria-describedby={urlError ? `${inputId}-error` : undefined}
          className="hive-input" />
      </div>
    </div>
    {urlError && <p id={`${inputId}-error`} className="mt-2 text-xs text-rose-600">{urlError}</p>}
  </div>
}
