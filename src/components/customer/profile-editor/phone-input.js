'use client'

import { AsYouType, getCountries, getCountryCallingCode } from 'libphonenumber-js/max'
import { phoneNumber } from '@/lib/profile-links'

const names = new Intl.DisplayNames(['en'], { type: 'region' })
const supportedCountries = getCountries()
const countries = supportedCountries.map(code => ({ code, name: names.of(code), callingCode: getCountryCallingCode(code) })).sort((a, b) => a.name.localeCompare(b.name))

export default function PhoneInput({ link, id, disabled, error, onChange, onBlur }) {
  const country = supportedCountries.includes(link.phone_country) ? link.phone_country : phoneNumber(link.url)?.country || 'GH'
  return <div className="flex flex-col gap-2">
    <label htmlFor={`${id}-country`} className="sr-only">Phone country</label>
    <select id={`${id}-country`} value={country} disabled={disabled} className="hive-input" onChange={event => onChange({ phone_country: event.target.value, url: '' })}>
      {countries.map(({ code, name, callingCode }) => <option key={code} value={code}>{name} (+{callingCode})</option>)}
    </select>
    <input id={id} type="tel" inputMode="tel" autoComplete="tel" value={link.url} disabled={disabled} maxLength={40}
      placeholder={`+${getCountryCallingCode(country)} · phone number`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-help`}
      onChange={event => {
        const raw = event.target.value.replace(/[^\d+ ()-]/g, '')
        const formatted = raw.length < link.url.length ? raw : new AsYouType(country).input(raw)
        const parsed = phoneNumber(formatted, country)
        onChange({ url: formatted, phone_country: parsed?.country || country })
      }} onBlur={() => {
        const parsed = phoneNumber(link.url, country)
        if (parsed?.isValid()) onChange({ url: parsed.formatInternational(), phone_country: parsed.country || country })
        onBlur({ ...link, phone_country: country })
      }} className="hive-input" />
    <p id={`${id}-help`} className="text-xs text-muted-foreground">Select a country, then enter the number with its area code.</p>
  </div>
}
