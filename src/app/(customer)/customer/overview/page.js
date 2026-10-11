'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { ArrowUpRight, ArrowRight, Copy, Check, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { customerRequest, useCustomerProfile } from '@/components/customer/customer-profile-context'
import NfcCollection, { itemEnabled } from '@/components/customer/nfc-collection'
import TapsOverTimeChart from '@/components/shared/taps-over-time-chart'
import ProfilePreviewModal from '@/components/customer/profile-preview-modal'

export default function OverviewPage() {
  const { profile, publication, account, items = [] } = useCustomerProfile()
  const { resolvedTheme } = useTheme()
  const [summary, setSummary] = useState(null)
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [preview, setPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await customerRequest(`/api/customer/analytics?days=${days}`, { signal: controller.signal })
        if (!controller.signal.aborted) setSummary(data)
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    load()
    return () => controller.abort()
  }, [days, attempt])
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 1800); return () => clearTimeout(timer) }, [copied])

  const publicItem = items.find(itemEnabled)
  const live = Boolean(publication && account?.setup_completed_at && publicItem)
  const identity = publication?.content || profile
  const photo = publication ? identity.photo_asset_id && publicItem ? `/api/public/photo/${encodeURIComponent(publicItem.slug)}` : null : profile.photo_url
  const name = identity.name || 'Your next introduction'
  const firstName = profile.name?.trim().split(/\s+/)[0] || 'there'
  async function copy() {
    try { await navigator.clipboard.writeText(publicItem.url); setCopied(true); toast.success('Profile link copied') }
    catch { toast.error('Could not copy your link. Please try again.') }
  }
  const nextStep = !account?.setup_completed_at
    ? { title: 'One more step to make it official.', text: 'Finish your account setup, then publish your digital identity.', href: '/forgot-password', action: 'Complete account setup' }
    : !publication
      ? { title: 'Your next connection starts here.', text: 'Refine your profile and publish it when you’re ready to share.', href: '/customer/profile', action: 'Make your profile live' }
      : !publicItem
        ? { title: 'Your profile is ready for its first tap.', text: 'Check your collection for an enabled NFC item to start sharing.', href: '/customer/my-cards', action: 'View your items' }
        : String(profile.revision) !== String(publication.revision)
          ? { title: 'Your latest ideas are still private.', text: 'Review your saved changes and publish the new revision when it’s ready.', href: '/customer/profile', action: 'Review your draft' }
          : { title: 'Make the next introduction count.', text: 'Share your profile, take your card with you, and watch your connections grow.', href: '/customer/my-cards', action: 'Get your QR code' }
  return <>
    <header data-reveal className="hive-overview-header"><div><p className="hive-eyebrow mb-3">Your hive, at a glance</p><h1 className="hive-page-title">Welcome back, {firstName}.</h1><p className="hive-page-subtitle">A little tap. A world of possibility.</p></div><Link href="/customer/profile" className="hive-text-link mb-2">Make it yours <ArrowUpRight size={16} /></Link></header>
    <div className="hive-overview-grid">
      <section data-reveal className="hive-panel hive-identity" aria-labelledby="identity-heading">
        <div className="hive-identity-portrait">{photo ? <Image src={photo} alt="" width={155} height={200} unoptimized /> : <span>{(identity.name || '?')[0].toUpperCase()}</span>}</div>
        <div className="hive-identity-copy"><div className="flex flex-wrap justify-between gap-3"><span className="hive-eyebrow">Your digital identity</span><span className="hive-status">{live ? 'Live & connected' : publication ? 'Published · awaiting an enabled item' : 'Private draft'}</span></div>
          <h2 id="identity-heading">{name}</h2><p>{identity.title || 'Make every introduction feel like you.'}</p>
          <div className="hive-identity-actions"><Link href="/customer/profile" className="hive-action hive-action-ink">Edit profile <ArrowUpRight size={16} /></Link>
            {live ? <><a href={publicItem.url} target="_blank" rel="noopener noreferrer" className="hive-action bg-white/50 text-[#302d1e]">View profile <ArrowUpRight size={15} /></a><button onClick={copy} className="hive-action bg-white/30 text-[#302d1e]" aria-label={copied ? 'Link copied' : 'Copy profile link'}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></> : <button className="hive-action bg-white/50 text-[#302d1e]" onClick={() => setPreview(true)}>Preview draft <Eye size={15} /></button>}
          </div>
        </div>
      </section>
      <NfcCollection items={items} name={profile.name} />
      <section data-reveal className="hive-panel hive-panel-pad hive-performance" aria-labelledby="performance-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="performance-heading" className="hive-section-title">Making connections</h2><div className="flex items-center gap-1 bg-secondary rounded-full p-1" aria-label="Overview analytics period">{['7','30','90'].map(period => <button key={period} onClick={() => setDays(period)} aria-pressed={days === period} className={`px-3 py-1.5 rounded-full text-[11px] transition-colors ${days === period ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>{period} days</button>)}</div></div>
        {error ? <div role="alert" className="py-10 text-sm text-rose-600"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)} className="mt-3 underline">Retry analytics</button></div> : <>
          <dl className="hive-performance-metrics" aria-busy={loading}>{[['Profile views',summary?.totalTaps],['Views today',summary?.todayTaps],['Contacts saved',summary?.contactDownloads]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{loading ? <span className="hive-skeleton block h-10 w-16" aria-label="Loading" /> : (value ?? 0).toLocaleString()}</dd></div>)}</dl>
          <TapsOverTimeChart data={summary?.daily ?? []} lines={[{ key: 'taps', color: '#c99a28', label: 'Profile views' }]} loading={loading} isDark={resolvedTheme === 'dark'} title={null} />
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border"><span className="text-[10px] text-muted-foreground">Profile views · UTC calendar dates</span><Link href="/customer/analytics" className="hive-text-link">Explore analytics <ArrowUpRight size={15} /></Link></div>
        </>}
      </section>
    </div>
    <section data-reveal className="hive-panel hive-next-steps"><div><p className="hive-eyebrow mb-2">What’s next</p><h2>{nextStep.title}</h2><p>{nextStep.text}</p></div><Link href={nextStep.href} className="hive-action hive-action-secondary shrink-0">{nextStep.action} <ArrowRight size={16} /></Link></section>
    <ProfilePreviewModal open={preview} onOpenChange={setPreview} slug={items[0]?.slug} formState={{ ...profile, photoUrl: profile.photo_url, showSaveContact: profile.show_save_contact, userInitial: profile.name?.[0]?.toUpperCase() }} />
  </>
}
