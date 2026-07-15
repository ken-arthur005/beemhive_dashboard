'use client'

import { UserPlus } from 'lucide-react'

export default function SaveContactButton({ ownerId }) {
  function handleDownload() {
    const a = document.createElement('a')
    a.href = `/api/vcard?userId=${ownerId}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <button
      onClick={handleDownload}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-gray-900 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 transition-colors"
    >
      <UserPlus size={16} />
      Save Contact
    </button>
  )
}
