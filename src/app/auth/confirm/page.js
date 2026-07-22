'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')
    const next = params.get('next') ?? '/invite'

    if (!token_hash || !type) {
      router.replace('/login')
      return
    }

    const supabase = createClient()
    supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) {
        router.replace('/login')
      } else {
        router.replace(next)
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
