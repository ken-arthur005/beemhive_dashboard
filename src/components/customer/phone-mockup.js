'use client'

import { LINK_TYPES } from './profile-editor/links-editor'

const DEFAULT_BG = 'linear-gradient(135deg, #0f172a, #1e293b)'

function resolveTheme(background) {
  const bg = background || DEFAULT_BG
  const isLight = /([#]([fFdDeE])|white|light)/i.test(bg)
  return {
    bg,
    nameClass: isLight ? 'text-gray-900' : 'text-white',
    mutedClass: isLight ? 'text-gray-500' : 'text-white/60',
    bodyClass: isLight ? 'text-gray-600' : 'text-white/70',
    footerClass: isLight ? 'text-gray-300' : 'text-white/30',
    linkClass: isLight ? 'text-gray-800' : 'text-white',
    linkBg: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.10)',
    linkBorder: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.20)',
    iconClass: isLight ? 'text-gray-500' : 'text-white/60',
  }
}

function LinkButton({ link, linkClass, linkBg, linkBorder, iconClass }) {
  const typeConfig = LINK_TYPES.find(t => t.value === link.type) ?? LINK_TYPES[0]
  const Icon = typeConfig.Icon
  const label = link.url || typeConfig.placeholder

  return (
    <a
      href={link.url || '#'}
      onClick={e => e.preventDefault()}
      className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm transition-colors ${linkClass}`}
      style={{ background: linkBg, border: linkBorder }}
    >
      <Icon size={15} className={`shrink-0 ${iconClass}`} />
      <span className="truncate">{link.label || label}</span>
    </a>
  )
}

export default function PhoneMockup({ slug, name, title, bio, links, showSaveContact, photoUrl, userInitial, background }) {
  const { bg, nameClass, mutedClass, bodyClass, footerClass, linkClass, linkBg, linkBorder, iconClass } = resolveTheme(background)
  return (
    <div className="rounded-[3rem] border-[8px] border-gray-800 bg-gray-800 shadow-2xl w-[300px] h-[600px] flex flex-col">
      <div className="rounded-[2.4rem] overflow-hidden bg-white flex flex-col flex-1">
        {/* Status bar */}
        <div className="h-6 bg-gray-900 flex items-center px-4 justify-between shrink-0">
          <span className="text-white text-[10px] font-medium">9:41</span>
          <div className="flex items-center gap-1">
            {/* Signal bars */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="white">
              <rect x="0" y="6" width="2.5" height="4" rx="0.5" />
              <rect x="3.5" y="4" width="2.5" height="6" rx="0.5" />
              <rect x="7" y="2" width="2.5" height="8" rx="0.5" />
              <rect x="10.5" y="0" width="2.5" height="10" rx="0.5" />
            </svg>
            {/* Battery */}
            <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
              <rect x="0.5" y="0.5" width="14" height="9" rx="1.5" stroke="white" strokeWidth="1" />
              <rect x="2" y="2" width="10" height="6" rx="0.5" fill="white" />
              <path d="M15 3.5v3a1 1 0 000-3z" fill="white" />
            </svg>
          </div>
        </div>

        {/* Browser chrome */}
        <div className="h-9 bg-gray-100 border-b border-gray-200 flex items-center justify-center gap-1.5 shrink-0 px-3">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-[11px] text-gray-500 truncate">
            beemhive.com/t/{slug ?? '...'}
          </span>
        </div>

        {/* Scrollable profile content */}
        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3" style={{ background: bg }}>
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-gray-900 text-2xl font-semibold">
                {userInitial ?? '?'}
              </div>
            )}
            {name && (
              <div className="text-center">
                <p className={`text-sm font-bold ${nameClass}`}>{name}</p>
                {title && <p className={`text-xs mt-0.5 ${mutedClass}`}>{title}</p>}
              </div>
            )}
            {bio && (
              <p className={`text-xs text-center leading-relaxed ${bodyClass}`}>{bio}</p>
            )}
          </div>

          {/* Links */}
          {links.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {links.map(link => (
                <LinkButton key={link.id} link={link} linkClass={linkClass} linkBg={linkBg} linkBorder={linkBorder} iconClass={iconClass} />
              ))}
            </div>
          )}

          {/* Save contact */}
          {showSaveContact && (
            <button className="w-full rounded-lg bg-amber-500 text-gray-900 text-xs font-medium py-2.5 text-center">
              Save Contact
            </button>
          )}

          {/* Footer */}
          <p className={`text-[10px] text-center mt-auto pt-2 ${footerClass}`}>
            Powered by Beem Hive
          </p>
        </div>

        {/* Bottom nav bar */}
        <div className="h-10 bg-gray-100 border-t border-gray-200 flex items-center justify-center gap-6 shrink-0">
          <span className="w-3 h-3 rounded-full bg-gray-300" />
          <span className="w-3 h-3 rounded-full bg-gray-300" />
          <span className="w-3 h-3 rounded-full bg-gray-300" />
        </div>
      </div>
    </div>
  )
}
