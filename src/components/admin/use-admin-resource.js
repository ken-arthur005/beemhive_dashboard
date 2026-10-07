'use client'

import { useEffect, useState } from 'react'
import { adminRequest } from './admin-api'

// Request identity makes loading immediate on a query change and prevents
// a superseded response from rendering under the new search/range label.
export function useAdminResource(url, normalize) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(null)
  const requestKey = `${url}:${revision}`
  useEffect(() => {
    const controller = new AbortController()
    adminRequest(url, { signal: controller.signal }).then(normalize).then(data => {
      if (!controller.signal.aborted) setResult({ requestKey, data, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ requestKey, data: null, error: error.message })
    })
    return () => controller.abort()
  }, [url, normalize, requestKey])
  const current = result?.requestKey === requestKey
  return {
    data: current ? result.data : null,
    loading: !current,
    error: current ? result.error : '',
    reload: () => setRevision(value => value + 1),
  }
}
