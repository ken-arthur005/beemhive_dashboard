'use client'

import ProfilePresentation from '@/components/public/profile-presentation'

export default function PhoneMockup({ name, title, bio, links = [], showSaveContact, photoUrl, background }) {
  return <div className="hive-phone-frame"><div className="hive-phone-camera" aria-hidden="true" /><div className="hive-phone-screen"><ProfilePresentation preview profile={{ name,title,bio,links,show_save_contact:showSaveContact,background }} photoUrl={photoUrl} /></div></div>
}
