import Brand from '@/components/shared/brand'
import { appOrigin } from '@/lib/platform'

const DEFAULT_BG = 'linear-gradient(135deg, #0f172a, #1e293b)'

export default function NotFound() {
  return (
    <main id="main-content"
      className="min-h-screen w-full flex flex-col items-center justify-center px-4"
      style={{ background: DEFAULT_BG }}
    >
      <div className="text-white"><Brand /></div>
      <h1 className="mt-8 text-3xl font-medium text-white">Profile not found</h1>
      <p className="mt-1 text-sm text-center text-white/60 max-w-xs">
        This link doesn&apos;t match any Beem Hive profile.
      </p>
      <div className="mt-10 flex justify-center">
        <a
          href={appOrigin()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-white/40"
        >
          Visit Beem Hive ↗
        </a>
      </div>
    </main>
  )
}
