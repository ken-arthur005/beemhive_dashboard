'use client'

import { useId, useState } from 'react'
import { useDebouncedSearch } from './use-admin-list'
import { inputClass, Notice } from './admin-controls'
import { Button } from '@/components/ui/button'
import { useAdminResource } from './use-admin-resource'

function customerOptions(data) {
  if (!Array.isArray(data.customers)) throw new Error('Customer options are unavailable. Please retry.')
  return data.customers
}

export default function CustomerSelector({ value, onChange, excludeId, disabled = false }) {
  const id = useId()
  const [search, setSearch] = useState('')
  const query = useDebouncedSearch(search)
  const { data, loading, error, reload } = useAdminResource(`/api/admin/customer-options?${new URLSearchParams({ search: query })}`, customerOptions)
  const options = (data || []).filter(customer => customer.user_id !== excludeId)
  if (value && !options.some(customer => customer.user_id === value.user_id)) options.unshift(value)

  return <div className="space-y-2">
    <label htmlFor={`${id}-search`} className="block text-sm font-medium">Search existing customers</label>
    <input id={`${id}-search`} className={inputClass} type="search" placeholder="Name or email" value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} />
    <label htmlFor={`${id}-customer`} className="block text-sm font-medium">Existing customer</label>
    <select id={`${id}-customer`} className={inputClass} required value={value?.user_id || ''} disabled={disabled || loading || !!error} onChange={event => onChange(options.find(customer => customer.user_id === event.target.value) || null)}>
      <option value="">{loading ? 'Loading customers…' : 'Choose a customer'}</option>
      {options.map(customer => <option key={customer.user_id} value={customer.user_id}>{customer.name || customer.email} — {customer.email}</option>)}
    </select>
    {loading && <p role="status" className="text-xs text-gray-500">Loading customer options…</p>}
    <Notice error={error} />
    {error && <Button type="button" variant="outline" onClick={reload}>Retry customer search</Button>}
    {!loading && !error && !options.length && <p className="text-xs text-gray-500">No customers found. Try another search.</p>}
  </div>
}
