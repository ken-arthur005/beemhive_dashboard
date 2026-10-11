export function BeeMark({ className = '', ...props }) {
  return <svg viewBox="0 0 270 200" fill="none" className={className} aria-hidden="true" {...props}>
    <image href="/logo.png" width="270" height="327" />
  </svg>
}

export default function Brand({ compact = false, className = '' }) {
  return <span className={`hive-brand ${className}`}>
    <BeeMark className="hive-brand-mark" />
    {!compact && <span>Beem<span className="hive-brand-accent"> Hive</span></span>}
  </span>
}
