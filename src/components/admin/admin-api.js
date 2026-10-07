export async function adminRequest(url, { body, ...options } = {}) {
  let response
  try {
    response = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { ...options.headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('The server could not be reached. The request may have completed; retry to confirm its result.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data || data.error) {
    const error = new Error(typeof data?.error === 'string' ? data.error : data?.error?.message || data?.message || `Request failed (${response.status}). Please retry.`)
    error.status = response.status
    error.code = data?.code
    error.jobId = data?.jobId ?? data?.job?.id
    error.jobStatus = data?.jobStatus ?? data?.status ?? data?.job?.status
    throw error
  }
  return data
}

export function requireCompletedDeletion(data) {
  if (data.success !== true) {
    const error = new Error('Cleanup is not confirmed complete. Retry to resume the same deletion job.')
    error.jobId = data.jobId ?? data.job?.id
    error.jobStatus = data.status ?? data.job?.status
    throw error
  }
  return data
}
