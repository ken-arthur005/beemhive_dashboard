'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Copy, Check, Eye, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { createDraftSaveQueue, profileDraft } from '@/lib/draft-save-queue'
import { itemUrl } from '@/lib/platform'
import { useCustomerProfile, customerRequest } from '@/components/customer/customer-profile-context'
import PhotoUploader from '@/components/customer/profile-editor/photo-uploader'
import BasicInfoFields from '@/components/customer/profile-editor/basic-info-fields'
import LinksEditor from '@/components/customer/profile-editor/links-editor'
import SaveContactToggle from '@/components/customer/profile-editor/save-contact-toggle'
import ProfilePreviewModal from '@/components/customer/profile-preview-modal'
import PhoneMockup from '@/components/customer/phone-mockup'

const THEME_PRESETS = [
  { name: 'Honey', value: 'linear-gradient(135deg, #f8edcc, #ecd18a)' },
  { name: 'Ivory', value: '#f7f6f2' },
  { name: 'Midnight', value: 'linear-gradient(135deg, #0f172a, #1e293b)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #052e16, #14532d)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #0c4a6e, #0ea5e9)' },
  { name: 'Dusk', value: 'linear-gradient(135deg, #2e1065, #4c1d95)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #7c2d12, #c2410c)' },
  { name: 'Rose', value: 'linear-gradient(135deg, #881337, #e11d48)' },
  { name: 'Slate', value: 'linear-gradient(135deg, #1e293b, #475569)' },
  { name: 'Pure Black', value: '#000000' },
]
const secondary = 'hive-action hive-action-outline'

function Section({ title, step, children }) {
  return <section className="hive-panel hive-panel-pad flex flex-col gap-5"><div className="flex items-baseline justify-between"><h2 className="hive-section-title">{title}</h2><span className="hive-eyebrow">{step}</span></div>{children}</section>
}

export default function ProfilePage() {
  const { profile, account, publication, items, setData, setProfile, setNavigationBlocked, confirmNavigation } = useCustomerProfile()
  const queueRef = useRef(null)
  const lockedRef = useRef(false)
  const [queueState, setQueueState] = useState(() => ({ draft: profileDraft(profile), revision: profile.revision, dirty: false, saving: false, error: null, conflict: false }))
  const [photoUrl, setPhotoUrl] = useState(profile.photo_url ?? null)
  const [action, setAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef(null)

  useEffect(() => {
    let mounted = true
    const queue = createDraftSaveQueue({
      profile,
      save: async payload => {
        if (!payload.draft.name.trim()) throw new Error('Display name is required. Your changes remain unsaved.')
        const result = await customerRequest('/api/customer/profile', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        return result.profile
      },
      reload: async () => {
        const data = await customerRequest('/api/customer/profile')
        if (mounted) setData(data)
        return data.profile
      },
      onChange: state => {
        setQueueState(state)
        setProfile(state.profile)
        // The API only exposes authenticated previews. Derive new media previews from IDs.
        setPhotoUrl(state.draft.photo_asset_id
          ? `/api/customer/media/${encodeURIComponent(state.draft.photo_asset_id)}` : null)
      },
    })
    queueRef.current = queue
    return () => { mounted = false; queue.dispose(); queueRef.current = null; clearTimeout(copyTimer.current) }
    // One queue per editor mount; later context updates are acknowledgements, not resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setNavigationBlocked(Boolean(queueState?.dirty || uploading || action))
    return () => setNavigationBlocked(false)
  }, [queueState?.dirty, uploading, action, setNavigationBlocked])

  useEffect(() => {
    function beforeUnload(event) {
      if (queueRef.current?.getState().dirty || lockedRef.current || uploading) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    // Capture native links as well as Next navigation. Sidebar also uses onNavigate.
    function leaving(event) {
      const link = event.target.closest?.('a[href]')
      if (!link || link.hasAttribute('data-customer-navigation') || link.target === '_blank' || link.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = new URL(link.href, location.href)
      if (target.href === location.href || (target.pathname === location.pathname && target.hash)) return
      if (!confirmNavigation()) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', beforeUnload)
    function traversal(event) {
      if (event.navigationType === 'traverse' && event.cancelable && !confirmNavigation()) event.preventDefault()
    }
    window.navigation?.addEventListener('navigate', traversal)
    document.addEventListener('click', leaving, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.navigation?.removeEventListener('navigate', traversal)
      document.removeEventListener('click', leaving, true)
    }
  }, [uploading, confirmNavigation])

  function update(patch) {
    if (!lockedRef.current) { setActionError(null); queueRef.current.update(patch) }
  }

  async function runAction(kind) {
    if (lockedRef.current || uploading) return
    lockedRef.current = true
    setAction(kind)
    setActionError(null)
    try {
      if (kind === 'unpublish') {
        await customerRequest('/api/customer/profile/publish', { method: 'DELETE' })
        setData(previous => ({ ...previous, publication: null, account: { ...previous.account, published_revision: null } }))
        toast.success('Profile unpublished. Your draft is retained.')
      } else {
        const queue = queueRef.current
        const saved = await queue.flush()
        if (queueRef.current !== queue) throw new Error('Draft editor has closed.')
        if (kind === 'publish') {
          const result = await customerRequest('/api/customer/profile/publish', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: saved.revision }),
          })
          setData(previous => ({ ...previous, ...result }))
          toast.success(`Revision ${result.publication.revision} published`)
        } else toast.success(`Private draft revision ${saved.revision} saved`)
      }
    } catch (failure) {
      setActionError(failure.message)
      // Publish CAS can conflict after the final save; refresh publication/account only.
      if (kind === 'publish' && failure.status === 409 && queueRef.current && !queueRef.current.getState().conflict) {
        try {
          const review = await queueRef.current.refresh()
          setActionError(review.message)
        } catch (reloadError) { setActionError(`Could not reload the newer draft: ${reloadError.message}. Your pending edits are retained.`) }
      }
    } finally { lockedRef.current = false; setAction(null) }
  }

  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch { toast.error('Could not copy. Select the URL and copy it manually.') }
  }

  if (!queueState) return <p role="status" className="text-sm text-gray-500">Loading your private draft…</p>
  const draft = queueState.draft
  const setupComplete = Boolean(account?.setup_completed_at)
  const eligible = account?.status === 'active' && setupComplete
  const slug = items?.[0]?.slug
  const url = items?.[0]?.url || (slug ? itemUrl(slug) : null)
  const formState = {
    ...draft, showSaveContact: draft.show_save_contact, photoUrl,
    userInitial: draft.name?.[0]?.toUpperCase() ?? '?',
  }

  return (
    <div className="hive-editor-page text-gray-900 dark:text-gray-100">
      <header className="mb-8" data-reveal>
        <p className="hive-eyebrow mb-3">Your identity, thoughtfully made</p><h1 className="hive-page-title">My Profile</h1>
        <p className="hive-page-subtitle">Make it feel like you. Every edit stays private until you publish.</p>
      </header>
      {!setupComplete && <div className="mb-5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm">
        <p className="font-medium">Complete account setup before publishing</p>
        <p className="mt-1 text-gray-600 dark:text-gray-400">You can edit and save your draft now. Request a setup email, then follow its secure link to set your password. Signing in alone does not complete setup.</p>
        <Link href="/forgot-password" className="inline-block mt-2 font-medium text-amber-700 dark:text-amber-400 underline">Request setup email</Link>
      </div>}
      <div className="hive-editor-grid">
        <fieldset disabled={Boolean(action)} className="min-w-0 flex flex-col gap-5" data-reveal>
          <legend className="sr-only">Private profile draft</legend>
          <Section title="The introduction" step="01 / Identity">
            <div className="flex items-center gap-5"><PhotoUploader photoUrl={photoUrl} userInitial={formState.userInitial}
              disabled={Boolean(action)} onBusyChange={setUploading}
              onPhotoChange={asset => { setPhotoUrl(asset?.url ?? null); update({ photo_asset_id: asset?.id ?? null }) }} /><div><p className="text-sm font-medium">Put a face to your name.</p><p className="text-xs text-muted-foreground mt-1 leading-relaxed">A great photo makes your first impression personal.</p></div></div>
            <BasicInfoFields name={draft.name} title={draft.title} bio={draft.bio}
              fieldErrors={!draft.name.trim() && queueState.error ? { name: 'Display name is required' } : {}}
              onNameChange={name => update({ name })} onTitleChange={title => update({ title })} onBioChange={bio => update({ bio })} />
          </Section>
          <Section title="Ways to connect" step="02 / Links">
            <LinksEditor links={draft.links} onChange={links => update({ links })} disabled={Boolean(action)} />
            <SaveContactToggle checked={draft.show_save_contact} onChange={show_save_contact => update({ show_save_contact })} disabled={Boolean(action)} />
          </Section>
          <Section title="Set the mood" step="03 / Appearance">
            <p className="text-xs text-gray-500 dark:text-gray-400">Choose the background for the next published revision.</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">{THEME_PRESETS.map(preset => {
              const selected = (draft.background ?? 'linear-gradient(135deg, #0f172a, #1e293b)') === preset.value
              return <button key={preset.name} type="button" aria-label={preset.name} aria-pressed={selected} title={preset.name}
                onClick={() => update({ background: preset.value })}
                className="hive-theme-swatch"
                style={{ background: preset.value, outline: selected ? '2px solid var(--ring)' : undefined }}>
                {selected && <Check size={18} className="absolute top-3 right-3 text-white bg-[#242820] rounded-full p-0.5" />}<span>{preset.name}</span>
              </button>
            })}</div>
          </Section>
        </fieldset>
        <aside className="min-w-0" data-reveal><div className="lg:sticky lg:top-6 flex flex-col gap-5"><div className="hive-panel hive-panel-pad flex flex-col gap-4">
          <section aria-labelledby="publication-title">
            <div className="flex justify-between items-center"><h2 id="publication-title" className="hive-section-title">Ready for the world?</h2><span className="hive-status text-muted-foreground">{publication ? 'Published' : 'Private'}</span></div>
            <p className="mt-2 text-sm">{publication ? `Published revision ${publication.revision}` : 'Unpublished — your profile is private'}</p>
            {publication?.published_at && <p className="text-xs text-gray-500 mt-1">Published {new Date(publication.published_at).toLocaleString()}</p>}
            {publication && <p className="mt-2 text-xs text-gray-500">Public name: {publication.content?.name || '—'}. Draft edits do not change this snapshot.</p>}
          </section>
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
            <p className="text-xs text-gray-500" role="status" aria-live="polite">{queueState.saving ? 'Saving private draft…' : queueState.dirty ? 'Unsaved draft changes' : `Private draft saved · revision ${queueState.revision}`}</p>
            {(queueState.error || actionError) && <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">{actionError || queueState.error.message}</p>}
            <div className="mt-3 flex flex-col gap-2">
              <button className={secondary} disabled={Boolean(action) || uploading || (!queueState.dirty && !queueState.error)} onClick={() => runAction('save')}>
                {action === 'save' ? 'Saving…' : queueState.conflict ? 'Save reviewed draft' : 'Save private draft'}
              </button>
              <button className="hive-action hive-action-primary"
                disabled={!eligible || Boolean(action) || uploading || queueState.conflict || !draft.name.trim() || (!queueState.dirty && publication && String(publication.revision) === String(queueState.revision))}
                onClick={() => runAction('publish')}>{action === 'publish' ? 'Publishing…' : 'Publish latest draft'}</button>
              <p className="text-xs text-gray-500">Publish saves pending edits first, then makes that revision public across your eligible items.</p>
              {publication && <><Link href="/customer/overview" className="hive-text-link justify-center py-2">Go to your overview <ArrowUpRight size={15} /></Link><button className="text-xs text-muted-foreground underline py-2 disabled:opacity-50" disabled={Boolean(action)} onClick={() => runAction('unpublish')}>{action === 'unpublish' ? 'Unpublishing…' : 'Unpublish profile'}</button></>}
            </div>
          </div>
          <button className={`${secondary} flex items-center justify-center gap-2`} onClick={() => setPreviewOpen(true)}><Eye size={15} />Preview private draft</button>
          {url ? <div>
            <label htmlFor="profile-url" className="block text-xs font-medium text-gray-500 mb-2">Your NFC URL</label>
            <div className="flex gap-2 items-center rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2">
              <input id="profile-url" readOnly value={url} className="w-full min-w-0 font-mono text-xs bg-transparent" />
              <button aria-label={copied ? 'URL copied' : 'Copy profile URL'} onClick={() => copyUrl(url)}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            </div>
            <p className="mt-2 text-xs text-gray-500">This URL only opens a profile after setup and publication, with the item enabled.</p>
          </div> : <p className="text-xs text-gray-500">No NFC item assigned yet. You can still prepare your profile.</p>}
        </div><div className="hive-editor-preview"><div className="flex items-center justify-between mb-4"><p className="hive-eyebrow">Your private draft</p><button className="hive-text-link" onClick={() => setPreviewOpen(true)}>Expand <ArrowUpRight size={14} /></button></div><div className="flex justify-center"><PhoneMockup {...formState} /></div></div></div></aside>
      </div>
      <ProfilePreviewModal open={previewOpen} onOpenChange={setPreviewOpen} slug={slug} formState={formState} />
    </div>
  )
}
