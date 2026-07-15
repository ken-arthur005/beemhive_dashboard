'use client'

const inputBase = 'w-full rounded-lg border bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-colors'
const inputNormal = `${inputBase} border-gray-300 dark:border-gray-700 focus:ring-amber-400`
const inputError = `${inputBase} border-rose-500 focus:ring-rose-500`
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export default function BasicInfoFields({ name, title, bio, fieldErrors, onNameChange, onTitleChange, onBioChange }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="profile-name" className={labelClass} style={{ marginBottom: 0 }}>Display name</label>
          <span className="text-xs text-gray-400">{name.length}/60</span>
        </div>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value.slice(0, 60))}
          placeholder="e.g. Kofi Mensah"
          maxLength={60}
          className={fieldErrors?.name ? inputError : inputNormal}
        />
        {fieldErrors?.name && (
          <p className="mt-1 text-xs text-rose-500">{fieldErrors.name}</p>
        )}
      </div>

      {/* Title */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="profile-title" className={labelClass} style={{ marginBottom: 0 }}>Title or role</label>
          <span className="text-xs text-gray-400">{title.length}/80</span>
        </div>
        <input
          id="profile-title"
          type="text"
          value={title}
          onChange={e => onTitleChange(e.target.value.slice(0, 80))}
          placeholder="e.g. Product Designer at Acme Co."
          maxLength={80}
          className={inputNormal}
        />
      </div>

      {/* Bio */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="profile-bio" className={labelClass} style={{ marginBottom: 0 }}>Bio</label>
          <span className="text-xs text-gray-400">{bio.length}/200</span>
        </div>
        <textarea
          id="profile-bio"
          value={bio}
          onChange={e => onBioChange(e.target.value.slice(0, 200))}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          placeholder="Write a short bio…"
          rows={3}
          maxLength={200}
          className={`${inputNormal} resize-none overflow-hidden`}
        />
      </div>
    </div>
  )
}
