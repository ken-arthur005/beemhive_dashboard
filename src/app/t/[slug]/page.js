import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { publicProfile } from '@/lib/public-profile'
import { checked } from '@/lib/data'
import { appOrigin } from '@/lib/platform'
import ProfilePresentation, { DEFAULT_PROFILE_BACKGROUND } from '@/components/public/profile-presentation'

export const dynamic = 'force-dynamic'

export default async function PublicProfilePage({ params }) {
  const { slug } = await params
  const { profile: resolved, supabase } = await publicProfile(slug, await headers(), 'profile_view')
  if (!resolved) {
    const item = checked(await supabase.from('nfc_items').select('id').eq('slug', slug).maybeSingle())
    if (!item) notFound()
    return <main id="main-content" className="min-h-screen flex flex-col items-center justify-center px-6 text-center text-white" style={{ background: DEFAULT_PROFILE_BACKGROUND }}>
      <CreditCard size={48} className="text-white/50" aria-hidden="true" />
      <h1 className="mt-5 text-xl font-semibold">This profile is not available</h1>
      <p className="mt-2 max-w-sm text-sm text-white/70">The owner may still be setting up their profile, or this item has been paused.</p>
    </main>
  }
  const profile = resolved.content
  return <main id="main-content"><ProfilePresentation profile={profile} slug={slug} photoUrl={profile.photo_asset_id ? `/api/public/photo/${encodeURIComponent(slug)}` : null} homeHref={appOrigin()} /></main>
}
