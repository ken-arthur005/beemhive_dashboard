import 'server-only'
import sharp from 'sharp'
import { HttpError } from './http'
import { checked } from './data'

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export async function safePhoto(buffer) {
  const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: 'warning' })
  const metadata = await image.metadata()
  if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
    throw new HttpError(415, 'Upload a single JPG, PNG or WebP photo.', 'invalid_image')
  }
  return image.rotate().resize(800, 800, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
}

export async function mediaResponse(supabase, asset) {
  const download = checked(await supabase.storage.from(asset.bucket).download(asset.object_path))
  if (!download || download.size > 16 * 1024 * 1024) throw new HttpError(404, 'This photo is unavailable. Please upload a replacement.')
  const buffer = await safePhoto(Buffer.from(await download.arrayBuffer()))
  return new Response(buffer, { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(buffer.length),
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } })
}

export async function boundedForm(request) {
  const max = MAX_PHOTO_BYTES + 65_536
  if (Number(request.headers.get('content-length') || 0) > max) throw new HttpError(413, 'Photo must be at most 5 MiB.')
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new HttpError(400, 'A photo upload is required.')
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, 'A photo upload is required.')
  const chunks = []
  let bytes = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > max) { await reader.cancel(); throw new HttpError(413, 'Photo must be at most 5 MiB.') }
    chunks.push(Buffer.from(value))
  }
  try { return await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') } }).formData() }
  catch { throw new HttpError(400, 'The upload could not be read.') }
}
