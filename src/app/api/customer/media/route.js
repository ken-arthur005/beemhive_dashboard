import { randomUUID } from 'node:crypto'
import { requireUser } from '@/lib/auth'
import { apiError, HttpError, jsonResponse } from '@/lib/http'
import { checked } from '@/lib/data'
import { boundedForm, safePhoto, MAX_PHOTO_BYTES } from '@/lib/media'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const { user, supabase } = await requireUser(request, { role: 'customer' })
    const bucket = checked(await supabase.storage.getBucket('profile-photos'))
    if (bucket.public) throw new HttpError(503, 'Private photo storage is awaiting deployment configuration.', 'storage_unconfigured')
    const form = await boundedForm(request)
    const file = form.get('file')
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_PHOTO_BYTES) throw new HttpError(413, 'Choose a photo of at most 5 MiB.')
    let bytes
    try { bytes = await safePhoto(Buffer.from(await file.arrayBuffer())) }
    catch (error) { throw error instanceof HttpError ? error : new HttpError(415, 'This image could not be decoded. Choose another photo.') }
    const id = randomUUID()
    const path = `${user.id}/${id}.jpg`
    checked(await supabase.storage.from('profile-photos').upload(path, bytes, { upsert: false, contentType: 'image/jpeg' }))
    const result = await supabase.rpc('register_profile_media', { p_user: user.id, p_id: id, p_path: path, p_size: bytes.length })
    if (result.error) {
      const cleanup = await supabase.storage.from('profile-photos').remove([path])
      if (cleanup.error) console.error('[media] Private upload cleanup requires retry')
      throw result.error
    }
    return jsonResponse({ asset: { id, url: `/api/customer/media/${id}` } }, 201)
  } catch (error) { return apiError(error) }
}
