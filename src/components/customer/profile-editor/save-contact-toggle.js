'use client'

import { Switch } from '@/components/ui/switch'

export default function SaveContactToggle({ checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Save contact button</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Adds a &apos;Save Contact&apos; button to your profile page so visitors can download your contact card
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}
