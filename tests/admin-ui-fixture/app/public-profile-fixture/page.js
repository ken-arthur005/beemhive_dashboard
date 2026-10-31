import ProfilePresentation from '@/components/public/profile-presentation'
import ProfileTracking from '@/components/public/profile-tracking'

export default async function ProfileFixture({ searchParams }) {
  const params = await searchParams
  const content = <ProfilePresentation profile={{
    name: 'Amara Mensah', title: 'Creative Director · Studio Amara', bio: 'Building brands that feel as good as they look.',
    background: params.theme === 'light' ? 'linear-gradient(135deg, #f8edcc, #ecd18a)' : 'linear-gradient(135deg, #0f172a, #1e293b)',
    links: [{ id: 'website',type: 'website',label: 'Explore my work',url: 'https://example.com' }, { id: 'linkedin',type: 'linkedin',url: 'https://linkedin.com' }, { id: 'custom', type: 'custom', label: 'My channel', url: 'https://youtube.com/@amara' }, { id: 'snapchat', type: 'snapchat', url: 'https://snapchat.com/add/amara' }],
    photo_shape: ['arch','square','circle','rounded'].includes(params.shape) ? params.shape : 'arch',
    show_save_contact: true,
  }} slug="fixture-profile" homeHref="/login" />
  return <main>{params.track === '1' ? <ProfileTracking slug="fixture-profile" revision={4}>{content}</ProfileTracking> : content}</main>
}
