import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/brand'
import { OrganizationForm } from '@/components/settings/org-form'
import { getMemberships, requireUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Set up your organization' }
export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const user = await requireUser()
  const memberships = await getMemberships(user.id)
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-12">
      <Logo href="/app" />
      <div className="mt-10 w-full max-w-xl rounded-xl border border-border-strong bg-surface p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">{memberships.length ? 'New organization' : 'Step 2 of 2'}</p>
        <h1 className="mt-2 text-lg font-semibold">Set up your organization</h1>
        <p className="mt-1 text-[13px] text-fg-muted">Your organization holds your clients, team, branding and deliverables. You will be its owner.</p>
        <div className="mt-6">
          <OrganizationForm mode="create" />
        </div>
      </div>
      {memberships.length ? (
        <Link href="/app" className="mt-6 text-[13px] text-fg-muted hover:text-fg">
          Back to {memberships[0].name}
        </Link>
      ) : (
        <p className="mt-6 max-w-sm text-center text-xs text-fg-subtle">Were you invited to an existing organization? Open the invitation link from your administrator instead.</p>
      )}
    </div>
  )
}
