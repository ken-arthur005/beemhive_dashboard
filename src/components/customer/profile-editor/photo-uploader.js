'use client'

import { useState, useRef } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'
import { useCustomerProfile } from '../customer-profile-context'

export default function PhotoUploader({ userId, photoUrl, onPhotoChange, userInitial }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(photoUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState(null)
  const { setProfile } = useCustomerProfile()

  const prevPhotoRef = useRef(photoUrl)

  function handleClick() {
    fileRef.current?.click()
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(null)

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.src = objectUrl
    img.onload = () => {
      const scale = Math.min(400 / img.width, 400 / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      canvas.toBlob(blob => uploadBlob(blob), 'image/jpeg', 0.85)
    }
  }

  async function uploadBlob(blob) {
    const blobUrl = URL.createObjectURL(blob)
    setPreview(blobUrl)
    setIsUploading(true)

    const supabase = createClient()
    const path = `${userId}/avatar.jpg`
    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

    if (uploadError) {
      setPreview(prevPhotoRef.current)
      setError('Upload failed — please try again.')
      setIsUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path)
    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

    await supabase.from('profiles').update({ photo_url: cacheBustedUrl }).eq('user_id', userId)

    prevPhotoRef.current = cacheBustedUrl
    setPreview(cacheBustedUrl)
    onPhotoChange(cacheBustedUrl)
    setProfile(prev => ({ ...prev, photo_url: cacheBustedUrl }))
    setIsUploading(false)
  }

  async function handleRemove() {
    setError(null)
    const supabase = createClient()
    await supabase.storage.from('profile-photos').remove([`${userId}/avatar.jpg`])
    await supabase.from('profiles').update({ photo_url: null }).eq('user_id', userId)
    prevPhotoRef.current = null
    setPreview(null)
    onPhotoChange(null)
    setProfile(prev => ({ ...prev, photo_url: null }))
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        onClick={handleClick}
        className="relative w-[120px] h-[120px] rounded-full cursor-pointer group select-none shrink-0"
      >
        {preview ? (
          <img
            src={preview}
            alt="Profile"
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-emerald-600 flex items-center justify-center text-white text-4xl font-semibold">
            {userInitial ?? '?'}
          </div>
        )}

        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
          {isUploading ? (
            <Loader2 size={24} className="text-white animate-spin" />
          ) : (
            <>
              <Camera size={22} className="text-white" />
              <span className="text-white text-xs font-medium">Change photo</span>
            </>
          )}
        </div>
      </div>

      {preview && !isUploading && (
        <button
          onClick={handleRemove}
          className="text-xs text-gray-400 hover:text-rose-500 transition-colors"
        >
          Remove photo
        </button>
      )}

      {error && (
        <p className="text-xs text-rose-500 text-center max-w-[200px]">{error}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
