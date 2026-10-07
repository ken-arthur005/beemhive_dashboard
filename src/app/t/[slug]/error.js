'use client'

export default function ProfileError({ reset }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 className="text-xl font-semibold">We couldn’t load this profile</h1>
    <p className="max-w-sm text-sm text-gray-500">Please try again in a moment.</p>
    <button type="button" onClick={reset} className="rounded-lg bg-amber-500 px-5 py-3 font-medium text-gray-900">Try again</button>
  </main>
}
