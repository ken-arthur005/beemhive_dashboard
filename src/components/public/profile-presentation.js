import { Globe, AtSign, Share2, Briefcase, MessageCircle, Phone, Mail, Link2, ArrowUpRight, UserPlus } from 'lucide-react'
import { linkDestination } from '@/lib/contact'
import Brand from '@/components/shared/brand'

const icons = { website: Globe, instagram: AtSign, twitter: Share2, linkedin: Briefcase, whatsapp: MessageCircle, phone: Phone, email: Mail, custom: Link2 }
const labels = { website: 'Website', instagram: 'Instagram', twitter: 'Twitter / X', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', phone: 'Phone', email: 'Email', custom: 'Visit link' }
export const DEFAULT_PROFILE_BACKGROUND = 'linear-gradient(135deg, #0f172a, #1e293b)'

export function lightProfileBackground(background) {
  if (/^(white|ivory|#fff)$/i.test(background.trim())) return true
  const colors = background.match(/#[a-f0-9]{6}/gi) || ['#0f172a']
  return colors.reduce((total,color) => {
    const channels = [1,3,5].map(index => parseInt(color.slice(index,index+2),16)/255)
    return total + channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722
  },0)/colors.length > .65
}

// Shared by the server-rendered public page and the authenticated draft preview.
export default function ProfilePresentation({ profile, photoUrl, slug, preview = false, homeHref }) {
  const background = profile.background || DEFAULT_PROFILE_BACKGROUND
  const light = lightProfileBackground(background)
  const style = {
    background,
    '--profile-text': light ? '#242820' : '#faf8ee',
    '--profile-muted': light ? '#54574b' : '#e4e5dcba',
    '--profile-line': light ? '#24282020' : '#ffffff26',
    '--profile-sheet': light ? '#fffdf3b3' : '#101b1fb3',
  }
  return <div className={`hive-public-presentation ${preview ? 'hive-public-preview' : ''}`} style={style}>
    <article className="hive-public-sheet">
      <header className="hive-public-header"><p className="hive-public-kicker">A little tap. A real connection.</p>
        <div className="hive-public-portrait">{photoUrl ? (
          // Authenticated and public protected image responses must bypass shared caches.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={profile.name ? `${profile.name}'s profile photo` : 'Profile photo'} width={130} height={160} />
        ) : <span>{profile.name?.[0]?.toUpperCase() || '?'}</span>}</div>
        <p className="hive-public-kicker mt-7">Hello, I’m</p><h1>{profile.name || 'Your name here'}</h1>
        {profile.title && <p className="hive-public-role">{profile.title}</p>}
        {profile.bio && <p className="hive-public-bio">{profile.bio}</p>}
      </header>
      <div className="hive-public-links">{(profile.links || []).map((link,index) => {
        const href = link.url?.trim() ? linkDestination(link) : null
        if (!href && !preview) return null
        const Icon = icons[link.type] || Link2
        const native = ['phone','email'].includes(link.type)
        return <a key={link.id || index} href={href || undefined} aria-disabled={!href} target={native ? undefined : '_blank'} rel="noopener noreferrer" referrerPolicy="no-referrer" className="hive-public-link">
          <Icon size={19} strokeWidth={1.5} aria-hidden="true" /><span>{link.label || labels[link.type] || 'Visit link'}</span><ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
        </a>
      })}</div>
      {profile.show_save_contact && (preview ? <button disabled className="hive-public-save"><UserPlus size={17} />Save Contact · preview only</button> : <a href={`/api/vcard?slug=${encodeURIComponent(slug)}`} className="hive-public-save"><UserPlus size={17} aria-hidden="true" />Save Contact <ArrowUpRight size={16} aria-hidden="true" /></a>)}
      <footer className="hive-public-footer"><span>Connected by</span>{homeHref ? <a href={homeHref} aria-label="Beem Hive"><Brand /></a> : <Brand />}</footer>
    </article>
  </div>
}
