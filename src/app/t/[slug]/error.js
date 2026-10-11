'use client'
import Brand from '@/components/shared/brand'

export default function ProfileError({ reset }) {
  return <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
    <Brand /><h1 className="hive-page-title mt-6">We couldn’t load this profile</h1>
    <p className="max-w-sm text-sm text-muted-foreground">Please try again in a moment.</p>
    <button type="button" onClick={reset} className="hive-action hive-action-primary mt-3">Try again</button>
  </main>
}
