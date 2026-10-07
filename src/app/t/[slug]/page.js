import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Globe, AtSign, Share2, Briefcase, MessageCircle, Phone, Mail, Link2, ExternalLink, CreditCard, UserPlus } from 'lucide-react'
import { publicProfile } from '@/lib/public-profile'
import { linkDestination } from '@/lib/contact'
import { checked } from '@/lib/data'
import { appOrigin } from '@/lib/platform'

export const dynamic = 'force-dynamic'
const icons = { website: Globe, instagram: AtSign, twitter: Share2, linkedin: Briefcase, whatsapp: MessageCircle, phone: Phone, email: Mail, custom: Link2 }
const labels = { website: 'Website', instagram: 'Instagram', twitter: 'Twitter / X', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', phone: 'Phone', email: 'Email', custom: 'Visit link' }
const defaultBackground = 'linear-gradient(135deg, #0f172a, #1e293b)'

function isLight(background) {
  const colors = background.match(/#[a-f0-9]{6}/gi) || ['#0f172a']
  return colors.reduce((total, color) => {
    const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255)
    return total + channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }, 0) / colors.length > 0.65
}

export default async function PublicProfilePage({ params }) {
  const { slug } = await params
  const { profile: resolved, supabase } = await publicProfile(slug, await headers(), 'profile_view')
  if (!resolved) {
    const item = checked(await supabase.from('nfc_items').select('id').eq('slug', slug).maybeSingle())
    if (!item) notFound()
    return <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center text-white" style={{ background: defaultBackground }}>
      <CreditCard size={48} className="text-white/50" aria-hidden="true" />
      <h1 className="mt-5 text-xl font-semibold">This profile is not available</h1>
      <p className="mt-2 max-w-sm text-sm text-white/70">The owner may still be setting up their profile, or this item has been paused.</p>
    </main>
  }
  const profile = resolved.content
  const background = profile.background || defaultBackground
  const light = isLight(background)
  const text = light ? 'text-gray-900' : 'text-white'
  const muted = light ? 'text-gray-600' : 'text-white/75'
  return <main className={`min-h-screen px-5 py-12 ${text}`} style={{ background }}>
    <div className="mx-auto max-w-sm">
      <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-amber-500 text-3xl font-semibold text-gray-900">
        {profile.photo_asset_id ? (
          // Protected image responses intentionally bypass the public image optimizer cache.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/public/photo/${encodeURIComponent(slug)}`} alt={`${profile.name}'s profile photo`} width={96} height={96} className="h-full w-full object-cover" />
        ) : profile.name?.[0]?.toUpperCase()}
      </div>
      <header className="text-center">
        <h1 className="break-words text-2xl font-bold">{profile.name}</h1>
        {profile.title && <p className={`mt-1 break-words text-sm font-medium ${muted}`}>{profile.title}</p>}
        {profile.bio && <p className={`mt-3 whitespace-pre-line break-words text-sm leading-relaxed ${muted}`}>{profile.bio}</p>}
      </header>
      <div className="mt-7 flex flex-col gap-3">{(profile.links || []).map((link, index) => {
        const href = linkDestination(link)
        if (!href) return null
        const Icon = icons[link.type] || Link2
        const native = ['phone', 'email'].includes(link.type)
        return <a key={link.id || index} href={href} target={native ? undefined : '_blank'} rel="noopener noreferrer" referrerPolicy="no-referrer"
          className="flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
          style={{ background: light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)', borderColor: light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)' }}>
          <Icon size={18} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{link.label || labels[link.type]}</span><ExternalLink size={14} aria-hidden="true" />
        </a>
      })}</div>
      {profile.show_save_contact && <a href={`/api/vcard?slug=${encodeURIComponent(slug)}`} className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400">
        <UserPlus size={17} aria-hidden="true" />Save Contact</a>}
      <footer className={`mt-10 text-center text-xs ${muted}`}><a href={appOrigin()}>Powered by Beem Hive</a></footer>
    </div>
  </main>
}
