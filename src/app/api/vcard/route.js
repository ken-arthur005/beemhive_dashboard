import { createClient } from '@/lib/supabase/server'

export async function GET(request) {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId) return new Response('Missing userId', { status: 400 })

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, title, bio, links')
    .eq('user_id', userId)
    .single()

  if (!profile) return new Response('Not found', { status: 404 })

  const links = Array.isArray(profile.links) ? profile.links : []
  const websiteUrl = links.find(l => l.type === 'website')?.url || ''
  const phoneUrl = links.find(l => l.type === 'phone')?.url || ''
  const emailUrl = links.find(l => l.type === 'email')?.url || ''

  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  if (profile.name) lines.push(`FN:${profile.name}`)
  if (profile.title) lines.push(`TITLE:${profile.title}`)
  if (profile.bio) lines.push(`NOTE:${profile.bio.replace(/\n/g, '\\n')}`)
  if (websiteUrl) lines.push(`URL:${websiteUrl}`)
  if (phoneUrl) lines.push(`TEL:${phoneUrl}`)
  if (emailUrl) lines.push(`EMAIL:${emailUrl}`)
  lines.push('END:VCARD')

  const vcf = lines.join('\r\n')
  const filename = (profile.name || 'contact').replace(/[^a-z0-9 ]/gi, '').trim() || 'contact'

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.vcf"`,
    },
  })
}
