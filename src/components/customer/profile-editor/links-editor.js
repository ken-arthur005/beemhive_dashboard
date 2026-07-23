'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import {
  Globe, AtSign, Share2, Briefcase, MessageCircle, Phone, Mail, Link2, Plus,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import SortableLinkItem from './sortable-link-item'

export const LINK_TYPES = [
  { value: 'website',   label: 'Website',     Icon: Globe,         placeholder: 'https://yourwebsite.com',        validate: u => u.startsWith('https://') },
  { value: 'instagram', label: 'Instagram',   Icon: AtSign,        placeholder: 'https://instagram.com/username', validate: u => u.includes('instagram.com') },
  { value: 'twitter',   label: 'Twitter / X', Icon: Share2,        placeholder: 'https://x.com/username',         validate: u => u.includes('x.com') || u.includes('twitter.com') },
  { value: 'linkedin',  label: 'LinkedIn',    Icon: Briefcase,     placeholder: 'https://linkedin.com/in/...',    validate: u => u.includes('linkedin.com') },
  { value: 'whatsapp',  label: 'WhatsApp',    Icon: MessageCircle, placeholder: 'https://wa.me/233XXXXXXXXX',     validate: u => u.startsWith('https://wa.me/') },
  { value: 'phone',     label: 'Phone',       Icon: Phone,         placeholder: '+233 XX XXX XXXX',               validate: u => /^\+\d/.test(u) },
  { value: 'email',     label: 'Email',       Icon: Mail,          placeholder: 'you@example.com',                validate: u => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u) },
  { value: 'custom',    label: 'Custom',      Icon: Link2,         placeholder: 'https://',                       validate: u => u.startsWith('https://') },
]

const MAX_LINKS = 8

export default function LinksEditor({ links, onChange, disabled }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIndex = links.findIndex(l => l.id === active.id)
    const newIndex = links.findIndex(l => l.id === over.id)
    onChange(arrayMove(links, oldIndex, newIndex))
  }

  function handleAdd() {
    if (links.length >= MAX_LINKS) return
    onChange([...links, { id: crypto.randomUUID(), type: 'website', url: '' }])
  }

  function handleUpdate(id, patch) {
    onChange(links.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  function handleDelete(id) {
    onChange(links.filter(l => l.id !== id))
  }

  const atMax = links.length >= MAX_LINKS

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {atMax ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  disabled
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-400 cursor-not-allowed select-none"
                />
              }
            >
              <Plus size={14} />
              Add link
            </TooltipTrigger>
            <TooltipContent>Maximum 8 links</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={handleAdd}
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none"
          >
            <Plus size={14} />
            Add link
          </button>
        )}
      </div>

      {links.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 px-4 py-8 text-center text-sm text-gray-400">
          No links yet — add your first link to get started
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {links.map(link => (
                <SortableLinkItem
                  key={link.id}
                  link={link}
                  linkTypes={LINK_TYPES}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
