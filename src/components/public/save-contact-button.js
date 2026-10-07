import { UserPlus } from 'lucide-react'

export default function SaveContactButton({ slug }) {
  return <a href={`/api/vcard?slug=${encodeURIComponent(slug)}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-amber-400">
    <UserPlus size={16} aria-hidden="true" />Save Contact
  </a>
}
