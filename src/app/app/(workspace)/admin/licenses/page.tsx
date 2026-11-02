import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageContainer, PageHeader, StatCard } from '@/components/ui/page'
import { SetupRequired } from '@/components/ui/states'
import { CreateLicenseDialog, LicenseTable } from '@/components/admin/license-admin'
import { isPlatformAdmin, requireOrgContext } from '@/lib/auth/session'
import { adminListLicenses } from '@/lib/licensing/service'
import { integrationStatus } from '@/lib/env'

export const metadata: Metadata = { title: 'License administration' }

export default async function LicenseAdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireOrgContext()
  // Platform admins only — return 404 to everyone else so the page is not discoverable.
  if (!(await isPlatformAdmin(ctx.userId))) notFound()
  const { q = '' } = await searchParams
  const licenses = await adminListLicenses(ctx.userId, q)
  const integ = integrationStatus()
  return (
    <PageContainer wide>
      <PageHeader title="License administration" description="Platform-level view of every license across all customers. Visible only to platform administrators." actions={integ.licensing ? <CreateLicenseDialog /> : null} />
      {!integ.licensing ? <SetupRequired className="mb-4" title="Licensing is not configured" description="Generate a long random secret and set it on the server before issuing licenses." envVars={['LICENSE_SECRET']} /> : null}
      {!integ.stripe ? <SetupRequired className="mb-4" title="Stripe is not configured" description="Online purchases are disabled. Manual licenses can still be issued." envVars={['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_STANDARD', 'STRIPE_PRICE_AGENCY']} /> : null}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Licenses" value={licenses.length} />
        <StatCard label="Active" value={licenses.filter((l) => l.status === 'active').length} />
        <StatCard label="Activated orgs" value={licenses.reduce((s, l) => s + Number(l.activeActivations ?? 0), 0)} />
        <StatCard label="Stripe revenue" value={`$${(licenses.filter((l) => l.source === 'stripe' && l.status !== 'revoked').reduce((s, l) => s + (l.amount_total ?? 0), 0) / 100).toLocaleString('en-US')}`} hint="Non-revoked Stripe purchases" />
      </div>
      <form className="mb-3 flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Search by email, name or last 4 characters" className="pl-8" aria-label="Search licenses" />
        </div>
        <Button variant="secondary" type="submit">
          Search
        </Button>
      </form>
      <LicenseTable licenses={licenses.map((l) => ({ ...l, activeActivations: Number(l.activeActivations ?? 0), expires_at: l.expires_at?.toISOString() ?? null, created_at: l.created_at.toISOString() }))} />
    </PageContainer>
  )
}
