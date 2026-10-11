import ProfilePresentation from '@/components/public/profile-presentation'

export default async function ProfileFixture({ searchParams }) {
  const params = await searchParams
  return <main><ProfilePresentation profile={{
    name: 'Amara Mensah', title: 'Creative Director · Studio Amara', bio: 'Building brands that feel as good as they look.',
    background: params.theme === 'light' ? 'linear-gradient(135deg, #f8edcc, #ecd18a)' : 'linear-gradient(135deg, #0f172a, #1e293b)',
    links: [{ id: 'website',type: 'website',label: 'Explore my work',url: 'https://example.com' }, { id: 'linkedin',type: 'linkedin',url: 'https://linkedin.com' }],
    show_save_contact: true,
  }} slug="fixture-profile" homeHref="/login" /></main>
}
