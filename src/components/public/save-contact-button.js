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
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors"
    >
      <UserPlus size={16} />
      Save Contact
    </button>
  )
}
