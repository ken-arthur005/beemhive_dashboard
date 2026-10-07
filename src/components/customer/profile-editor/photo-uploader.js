'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Camera, Loader2 } from 'lucide-react'
import { customerRequest } from '../customer-profile-context'

export default function PhotoUploader({ photoUrl, onPhotoChange, onBusyChange, userInitial, disabled }) {
  const fileRef = useRef(null)
  const controllerRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => () => controllerRef.current?.abort(), [])

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading || disabled) return
    setError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Upload a JPEG, PNG or WebP image.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Your photo must be 5 MiB or smaller.'); return }
    const controller = new AbortController()
    controllerRef.current = controller
    setUploading(true)
    onBusyChange(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const result = await customerRequest('/api/customer/media', { method: 'POST', body, signal: controller.signal })
      if (!controller.signal.aborted) onPhotoChange(result.asset)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message)
    } finally {
      if (!controller.signal.aborted) { setUploading(false); onBusyChange(false) }
    }
  }

  return <div className="flex flex-col items-center gap-3">
    <button type="button" disabled={uploading || disabled} aria-label="Change profile photo" aria-describedby="photo-help"
      onClick={() => fileRef.current?.click()} className="group relative w-[120px] h-[120px] rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500 disabled:opacity-60">
      {photoUrl ? <Image src={photoUrl} width={120} height={120} unoptimized alt="Draft profile photo" className="w-full h-full rounded-full object-cover" />
        : <span className="w-full h-full rounded-full bg-amber-500 flex items-center justify-center text-gray-900 text-4xl font-semibold">{userInitial ?? '?'}</span>}
      <span className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white ${uploading ? '' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
        {uploading ? <Loader2 size={24} className="animate-spin" /> : <Camera size={22} />}
      </span>
    </button>
    {photoUrl && <button type="button" disabled={uploading || disabled} onClick={() => onPhotoChange(null)} className="text-xs text-gray-500 hover:text-rose-600 disabled:opacity-50">Remove photo from draft</button>}
    <p id="photo-help" className="text-xs text-gray-500">JPEG, PNG or WebP · up to 5 MiB. Changes stay private.</p>
    {error && <p role="alert" className="text-xs text-rose-600 max-w-xs text-center">{error}</p>}
    <label htmlFor="profile-photo-file" className="sr-only">Upload profile photo</label>
    <input id="profile-photo-file" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
  </div>
}
