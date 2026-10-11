export class HttpError extends Error {
  constructor(status, message, code = 'request_failed') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export function apiError(error) {
  if (error instanceof HttpError) return jsonResponse({ error: error.message, code: error.code }, error.status)
  if (error?.code === '40001' || error?.message?.includes('revision_conflict') || error?.message?.includes('version_conflict')) {
    return jsonResponse({ error: 'This record changed elsewhere. Reload before saving.', code: 'conflict' }, 409)
  }
  if (error?.code === '23505') return jsonResponse({ error: 'That value is already in use.', code: 'duplicate' }, 409)
  if (error?.code === '42501') return jsonResponse({ error: 'This operation is not permitted.', code: 'forbidden' }, 403)
  if (['22023', '22P02'].includes(error?.code)) return jsonResponse({ error: 'The supplied values are not valid for this operation.', code: 'invalid_input' }, 400)
  if (error?.code === 'P0002') return jsonResponse({ error: 'The requested record was not found.', code: 'not_found' }, 404)
  if (error?.code === '23514') return jsonResponse({ error: 'This operation conflicts with the record’s lifecycle state.', code: 'invalid_state' }, 409)
  console.error('[api]', error?.code || 'internal', error?.message || 'Unexpected failure')
  return jsonResponse({ error: 'The operation could not be completed. Please try again.', code: 'internal_error' }, 500)
}

export async function readJson(request, maxBytes = 65_536) {
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new HttpError(413, 'Request is too large.')
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, 'A JSON request body is required.')
  let size = 0
  const chunks = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'Request is too large.') }
    chunks.push(value)
  }
  try {
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const value = JSON.parse(new TextDecoder().decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object')
    return value
  } catch { throw new HttpError(400, 'A valid JSON object is required.', 'invalid_json') }
}

export function assertSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
  if (request.headers.get('authorization')?.startsWith('Bearer ')) return
  const origin = request.headers.get('origin')
  const allowed = new Set([new URL(request.url).origin])
  // Vercel may expose an internal deployment origin on a request reached through
  // the public alias. Trust only the exact server-configured public origin too.
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const configured = new URL(process.env.NEXT_PUBLIC_APP_URL)
    if (['https:', 'http:'].includes(configured.protocol) && !configured.username && !configured.password) allowed.add(configured.origin)
  }
  if (!origin || origin === 'null' || !allowed.has(origin)) throw new HttpError(403, 'Cross-origin request rejected.', 'invalid_origin')
}
