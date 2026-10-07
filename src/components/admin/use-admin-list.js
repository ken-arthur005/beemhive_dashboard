'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAdminResource } from './use-admin-resource'

export function useAdminList(endpoint, key, params) {
  const query = new URLSearchParams(params).toString()
  const normalize = useCallback(data => {
    if (!Array.isArray(data[key]) || !Number.isFinite(data.total) || !Number.isInteger(data.page) || !Number.isInteger(data.pageSize) || data.pageSize < 1) {
      throw new Error('The server returned an invalid list response. Please retry.')
    }
    return { rows: data[key], total: data.total, page: data.page, pageSize: data.pageSize }
  }, [key])
  const resource = useAdminResource(`${endpoint}?${query}`, normalize)
  return { rows: [], total: 0, page: Number(params.page || 1), pageSize: 10, ...resource.data, ...resource }
}

export function useDebouncedSearch(value) {
  const [search, setSearch] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(value), 300)
    return () => clearTimeout(timer)
  }, [value])
  return search
}
