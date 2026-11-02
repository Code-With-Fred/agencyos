import type { Metadata } from 'next'
import { ProfileForm } from '@/components/settings/account-forms'
import { requireOrgContext } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Profile' }

export default async function ProfileSettingsPage() {
  const ctx = await requireOrgContext()
  return <ProfileForm name={ctx.user.name} email={ctx.user.email} />
}
