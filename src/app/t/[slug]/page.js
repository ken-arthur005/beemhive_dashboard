import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Image from 'next/image'
import {
  Globe, AtSign, Share2, Briefcase, MessageCircle, Phone, Mail, Link2,
  ExternalLink, CreditCard, UserPlus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { hashIp } from '@/lib/utils'
import SaveContactButton from '@/components/public/save-contact-button'

const ICON_MAP = {
  website: Globe,
  instagram: AtSign,
  twitter: Share2,
  linkedin: Briefcase,
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
  custom: Link2,
}

const LINK_LABELS = {
  website: 'Website',
  instagram: 'Instagram',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  email: 'Email',
}

const DEFAULT_BG = 'linear-gradient(135deg, #0f172a, #1e293b)'

function resolveBackground(background) {
  const bg = background || DEFAULT_BG
  const isLight = /([#]([fFdDeE])|white|light)/i.test(bg)
  return {
    bg,
    isLight,
    textClass: isLight ? 'text-gray-900' : 'text-white',
    mutedClass: isLight ? 'text-gray-500' : 'text-white/60',
    subtleClass: isLight ? 'text-gray-400' : 'text-white/40',
    shadowStyle: isLight ? {} : { textShadow: '0 1px 3px rgba(0,0,0,0.3)' },
    linkBg: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.12)',
    linkBorder: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.2)',
  }
}

function getLinkLabel(link) {
  if (link.label) return link.label
  if (link.type === 'custom') {
    try { return new URL(link.url).hostname } catch { return link.url }
  }
  return LINK_LABELS[link.type] || link.type
}

function BeemHiveFooter({ subtleClass }) {
  return (
    <div className="mt-10 flex justify-center">
      <a
        href="https://beemhive.com"
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 text-xs ${subtleClass}`}
      >
        <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
        Powered by Beem Hive
      </a>
    </div>
  )
}

function InactiveCard({ message = 'This NFC card has been temporarily deactivated.' }) {
  const { bg, textClass, mutedClass, subtleClass } = resolveBackground(null)
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4" style={{ background: bg }}>
      <CreditCard size={64} className={mutedClass} strokeWidth={1} />
      <h1 className={`mt-4 text-lg font-semibold ${textClass}`}>This card is not active</h1>
      <p className={`mt-1 text-sm text-center max-w-xs ${mutedClass}`}>{message}</p>
      <BeemHiveFooter subtleClass={subtleClass} />
    </div>
  )
}

function ActiveProfile({ profile, ownerId }) {
  const { bg, isLight, textClass, mutedClass, subtleClass, shadowStyle, linkBg, linkBorder } = resolveBackground(profile.background)
  const links = Array.isArray(profile.links) ? profile.links : []
  const initial = profile.name ? profile.name[0].toUpperCase() : '?'

  return (
    <div className="min-h-screen w-full" style={{ background: bg }}>
      <div className="max-w-sm mx-auto px-4 py-10">

        {/* Profile photo */}
        <div className="flex justify-center mb-5">
          <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden ring-2 ring-white/20 shrink-0">
            {profile.photo_url ? (
              <Image
                src={profile.photo_url}
                alt={profile.name || 'Profile photo'}
                width={96}
                height={96}
                className="rounded-full object-cover"
                priority
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-emerald-600 flex items-center justify-center text-white text-3xl font-bold">
                {initial}
              </div>
            )}
          </div>
        </div>

        {/* Name, title, bio */}
        <div className="text-center mb-6">
          <h1 className={`text-2xl font-bold ${textClass}`} style={shadowStyle}>
            {profile.name}
          </h1>
          {profile.title && (
            <p className={`mt-1 text-sm font-medium ${mutedClass}`} style={shadowStyle}>
              {profile.title}
            </p>
          )}
          {profile.bio && (
            <p className={`mt-2 text-sm leading-relaxed line-clamp-3 ${mutedClass}`} style={shadowStyle}>
              {profile.bio}
            </p>
          )}
        </div>

        {/* Links */}
        {links.length > 0 && (
          <div className="flex flex-col gap-3 mb-3">
            {links.map((link, i) => {
              const Icon = ICON_MAP[link.type] || Link2
              const label = getLinkLabel(link)
              return (
                <a
                  key={link.id || i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 rounded-xl py-3 px-4 transition-opacity hover:opacity-80 ${textClass}`}
                  style={{ background: linkBg, border: linkBorder }}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="flex-1 text-sm font-medium truncate">{label}</span>
                  <ExternalLink size={14} className={`shrink-0 ${mutedClass}`} />
                </a>
              )
            })}
          </div>
        )}

        {/* Save contact */}
        {profile.show_save_contact && (
          <div className="mt-3">
            <SaveContactButton ownerId={ownerId} />
          </div>
        )}

        <BeemHiveFooter subtleClass={subtleClass} />
      </div>
    </div>
  )
}

export default async function PublicProfilePage({ params }) {
  const { slug } = await params
  const supabase = await createClient()
  const headersList = await headers()

  // Step 1 — fetch NFC item
  const { data: nfcItem } = await supabase
    .from('nfc_items')
    .select('id, is_active, owner_id, product_type')
    .eq('slug', slug)
    .single()

  if (!nfcItem) notFound()

  if (!nfcItem.is_active) return <InactiveCard />

  // Step 2 — log tap event
  const userAgent = headersList.get('user-agent') || ''
  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent)
  const deviceType = isMobile ? 'mobile' : 'desktop'
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const referer = headersList.get('referer') || null
  const ipHash = await hashIp(ip)

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('tap_events')
    .select('*', { count: 'exact', head: true })
    .eq('nfc_item_id', nfcItem.id)
    .eq('ip_hash', ipHash)
    .gte('created_at', fiveMinutesAgo)

  if (count === 0) {
    await supabase.from('tap_events').insert({
      nfc_item_id: nfcItem.id,
      device_type: deviceType,
      referrer: referer,
      ip_hash: ipHash,
    })
  }

  // Step 3 — fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, title, bio, photo_url, links, show_save_contact, background')
    .eq('user_id', nfcItem.owner_id)
    .single()

  if (!profile) return <InactiveCard message="This profile hasn't been set up yet." />

  return <ActiveProfile profile={profile} ownerId={nfcItem.owner_id} />
}
