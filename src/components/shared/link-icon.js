import { Globe, Phone, Mail, Link2, MapPin, Star } from 'lucide-react'
import { siInstagram, siX, siWhatsapp, siSnapchat, siYoutube, siFacebook, siGithub, siTiktok, siTelegram, siSpotify,
  siBluesky, siPinterest, siThreads, siReddit, siMessenger, siDiscord, siTwitch, siSoundcloud, siApplemusic,
  siGoogledrive, siAppstore, siGooglemaps } from 'simple-icons'
import { LINK_TYPES, webUrl } from '@/lib/profile-links'

// Simple Icons supplies the brands' SVG artwork. LinkedIn's brand glyph is
// retained locally because it is no longer distributed by Simple Icons.
const linkedin = { path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452z' }
const brands = { instagram: siInstagram, twitter: siX, linkedin, whatsapp: siWhatsapp, snapchat: siSnapchat, youtube: siYoutube, facebook: siFacebook, github: siGithub, tiktok: siTiktok, telegram: siTelegram, spotify: siSpotify,
  bluesky: siBluesky, pinterest: siPinterest, threads: siThreads, reddit: siReddit, messenger: siMessenger, discord: siDiscord,
  twitch: siTwitch, soundcloud: siSoundcloud, applemusic: siApplemusic, googledrive: siGoogledrive, appstore: siAppstore, googlemaps: siGooglemaps }
// Prefer specific hosts (drive.google.com) over broad parent domains (google.com).
const domains = LINK_TYPES.flatMap(type => (type.hosts || []).map(host => [host, type.value])).sort((a, b) => b[0].length - a[0].length)

export default function LinkIcon({ type, url, size = 19, ...props }) {
  const host = type === 'custom' ? webUrl(url)?.hostname : null
  const detected = host && domains.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1]
  const brand = brands[detected || type]
  if (brand) return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d={brand.path} /></svg>
  const Icon = { website: Globe, phone: Phone, email: Mail, location: MapPin, googlereviews: Star }[detected || type] || Link2
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" {...props} />
}
