import { redirect } from 'next/navigation'

export default async function Home({ searchParams }) {
  const params = await searchParams
  const code = params?.code
  if (code) {
    const next = params?.next ?? '/invite'
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`)
  }
  redirect('/login')
}
