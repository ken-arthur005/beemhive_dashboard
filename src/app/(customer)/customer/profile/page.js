'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, Check, Eye, Loader2 } from 'lucide-react'

const THEME_PRESETS = [
  { name: 'Midnight', value: 'linear-gradient(135deg, #0f172a, #1e293b)' },
  { name: 'Forest',   value: 'linear-gradient(135deg, #052e16, #14532d)' },
  { name: 'Ocean',    value: 'linear-gradient(135deg, #0c4a6e, #0ea5e9)' },
  { name: 'Dusk',     value: 'linear-gradient(135deg, #2e1065, #4c1d95)' },
  { name: 'Sunset',   value: 'linear-gradient(135deg, #7c2d12, #c2410c)' },
  { name: 'Rose',     value: 'linear-gradient(135deg, #881337, #e11d48)' },
  { name: 'Slate',    value: 'linear-gradient(135deg, #1e293b, #475569)' },
  { name: 'Pure Black', value: '#000000' },
]
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useCustomerProfile } from '@/components/customer/customer-profile-context'
import { Separator } from '@/components/ui/separator'
import PhotoUploader from '@/components/customer/profile-editor/photo-uploader'
import BasicInfoFields from '@/components/customer/profile-editor/basic-info-fields'
import LinksEditor from '@/components/customer/profile-editor/links-editor'
import SaveContactToggle from '@/components/customer/profile-editor/save-contact-toggle'
import ProfilePreviewModal from '@/components/customer/profile-preview-modal'

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-4">
      {title && (
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      )}
      {children}
    </div>
  )
}

function CopyButton({ url }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      title="Copy URL"
    >
      {copied
        ? <Check size={14} className="text-amber-600" />
        : <Copy size={14} />
      }
    </button>
  )
}

function Spinner() {
  return <Loader2 size={14} className="animate-spin" />
}

export default function ProfilePage() {
  const supabase = createClient()
  const { setProfile } = useCustomerProfile()

  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [slug, setSlug] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [links, setLinks] = useState([])
  const [showSaveContact, setShowSaveContact] = useState(true)
  const [background, setBackground] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)

  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const autoSaveRef = useRef(null)
  const savedFlashRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const uid = session.user.id
        setUserId(uid)
        setUserEmail(session.user.email ?? '')

        const [profileRes, itemRes] = await Promise.all([
          supabase.from('profiles')
            .select('name, title, bio, links, show_save_contact, photo_url, background')
            .eq('user_id', uid)
            .maybeSingle(),
          supabase.from('nfc_items')
            .select('slug')
            .eq('owner_id', uid)
            .limit(1)
            .maybeSingle(),
        ])

        if (profileRes.data) {
          const p = profileRes.data
          setName(p.name ?? '')
          setTitle(p.title ?? '')
          setBio(p.bio ?? '')
          setLinks(Array.isArray(p.links) ? p.links : [])
          setShowSaveContact(p.show_save_contact ?? true)
          setBackground(p.background ?? null)
          setPhotoUrl(p.photo_url ?? null)
        }

        if (itemRes.data) {
          setSlug(itemRes.data.slug)
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  function scheduleAutoSave(overrides = {}) {
    clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => handleSave(true, overrides), 2000)
  }

  function markDirty() {
    setIsDirty(true)
  }

  function handleNameChange(val) {
    setName(val)
    markDirty()
    scheduleAutoSave()
  }

  function handleTitleChange(val) {
    setTitle(val)
    markDirty()
    scheduleAutoSave()
  }

  function handleBioChange(val) {
    setBio(val)
    markDirty()
    scheduleAutoSave()
  }

  function handleLinksChange(newLinks) {
    setLinks(newLinks)
    markDirty()
  }

  async function handleSaveContactToggle(val) {
    setShowSaveContact(val)
    markDirty()
    await handleSave(false, { showSaveContactOverride: val })
  }

  async function handleSave(silent = false, overrides = {}) {
    if (isSaving) return
    const effectiveName = name
    if (!effectiveName.trim()) {
      if (!silent) setFieldErrors({ name: 'Name is required' })
      return
    }

    setFieldErrors({})
    setIsSaving(true)

    const payload = {
      user_id: userId,
      name: effectiveName,
      title,
      bio,
      links,
      show_save_contact: overrides.showSaveContactOverride ?? showSaveContact,
      background: overrides.backgroundOverride ?? background,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' })

    if (error) {
      if (!silent) toast.error('Failed to save — please try again')
      setIsSaving(false)
      return
    }

    setIsDirty(false)
    setLastSaved(new Date())
    setProfile({ name: effectiveName, photo_url: photoUrl })

    if (!silent) {
      clearTimeout(savedFlashRef.current)
      setSavedFlash(true)
      savedFlashRef.current = setTimeout(() => setSavedFlash(false), 1500)
    }

    setIsSaving(false)
  }

  function handlePhotoChange(newUrl) {
    setPhotoUrl(newUrl)
    setProfile(prev => ({ ...prev, photo_url: newUrl }))
  }

  const userInitial = name ? name[0].toUpperCase() : (userEmail ? userEmail[0].toUpperCase() : '?')

  const formState = {
    name,
    title,
    bio,
    links,
    showSaveContact,
    background,
    photoUrl,
    userInitial,
  }

  const lastSavedLabel = lastSaved
    ? `Last saved: ${Math.max(0, Math.round((Date.now() - lastSaved.getTime()) / 60000))} min ago`
    : 'Not yet saved'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const saveButton = (
    <button
      onClick={() => handleSave(false)}
      disabled={isSaving || (!isDirty && !savedFlash)}
      className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-900 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isSaving
        ? <><Spinner /> Saving…</>
        : savedFlash
          ? <><Check size={14} /> Saved!</>
          : 'Save changes'
      }
    </button>
  )

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">My Profile</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Customize what people see when they tap your card
          </p>
          {isDirty && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Unsaved changes
            </div>
          )}
        </div>

        {/* Mobile: preview + save */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Preview profile"
          >
            <Eye size={18} />
          </button>
        </div>
      </div>

      {/* Desktop two-column grid */}
      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        {/* Left: editor */}
        <div className="md:col-span-2 flex flex-col gap-5">
          <Section title="Basic info">
            <div className="flex justify-center">
              <PhotoUploader
                userId={userId}
                photoUrl={photoUrl}
                onPhotoChange={handlePhotoChange}
                userInitial={userInitial}
              />
            </div>
            <BasicInfoFields
              name={name}
              title={title}
              bio={bio}
              fieldErrors={fieldErrors}
              onNameChange={handleNameChange}
              onTitleChange={handleTitleChange}
              onBioChange={handleBioChange}
            />
          </Section>

          <Section title="Links">
            <LinksEditor
              links={links}
              onChange={handleLinksChange}
              disabled={isSaving}
            />
            <SaveContactToggle
              checked={showSaveContact}
              onChange={handleSaveContactToggle}
              disabled={isSaving}
            />
          </Section>

          <Section title="Profile theme">
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
              Choose the background for your public profile page
            </p>
            <div className="grid grid-cols-4 gap-3">
              {THEME_PRESETS.map(preset => {
                const isSelected = (background ?? THEME_PRESETS[0].value) === preset.value
                return (
                  <button
                    key={preset.name}
                    title={preset.name}
                    onClick={() => { setBackground(preset.value); markDirty(); scheduleAutoSave({ backgroundOverride: preset.value }) }}
                    className="relative w-14 h-14 rounded-xl overflow-hidden ring-2 transition-all"
                    style={{
                      background: preset.value,
                      ringColor: isSelected ? '#f59e0b' : 'transparent',
                      outline: isSelected ? '2px solid #f59e0b' : '2px solid transparent',
                    }}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check size={18} className="text-white drop-shadow" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </Section>
        </div>

        {/* Right: sticky save card — desktop only */}
        <div className="hidden md:block">
          <div className="sticky top-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col gap-4">
            {/* Profile URL */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Your profile URL
              </p>
              {slug ? (
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2">
                  <code className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">
                    https://beemhive.com/t/{slug}
                  </code>
                  <CopyButton url={`https://beemhive.com/t/${slug}`} />
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No card assigned yet</p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                This is the link written to your NFC card
              </p>
            </div>

            <Separator />

            {/* Save controls */}
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">{lastSavedLabel}</p>
              {isDirty && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  You have unsaved changes
                </div>
              )}
              {saveButton}
            </div>

            <Separator />

            {/* Preview button */}
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Eye size={15} />
              Preview profile
            </button>
          </div>
        </div>
      </div>

      {/* Mobile fixed bottom save bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{lastSavedLabel}</p>
        </div>
        <div className="w-40 shrink-0">
          {saveButton}
        </div>
      </div>

      {/* Preview modal */}
      <ProfilePreviewModal
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        slug={slug}
        formState={formState}
      />
    </>
  )
}
