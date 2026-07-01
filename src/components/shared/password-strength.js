function getStrength(password) {
  if (password.length < 8) return { label: 'Too short', color: 'bg-rose-400', width: '25%' }
  const types = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(password)).length
  if (types === 1) return { label: 'Weak', color: 'bg-amber-400', width: '40%' }
  if (types === 2) return { label: 'Good', color: 'bg-blue-400', width: '70%' }
  return { label: 'Strong', color: 'bg-emerald-500', width: '100%' }
}

export default function PasswordStrength({ password }) {
  if (!password.length) return null
  const { label, color, width } = getStrength(password)
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width }}
        />
      </div>
      <span className="text-xs text-gray-500 w-14 text-right shrink-0">{label}</span>
    </div>
  )
}
