import { Search } from 'lucide-react'

const DEFAULT_BG = 'linear-gradient(135deg, #0f172a, #1e293b)'

export default function NotFound() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4"
      style={{ background: DEFAULT_BG }}
    >
      <Search size={64} className="text-white/30" strokeWidth={1} />
      <h1 className="mt-4 text-lg font-semibold text-white">Profile not found</h1>
      <p className="mt-1 text-sm text-center text-white/60 max-w-xs">
        This link doesn&apos;t match any Beem Hive profile.
      </p>
      <div className="mt-10 flex justify-center">
        <a
          href="https://beemhive.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-white/40"
        >
          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
          Powered by Beem Hive
        </a>
      </div>
    </div>
  )
}
