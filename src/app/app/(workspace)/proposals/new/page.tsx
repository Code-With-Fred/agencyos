import type { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { ModuleGate } from '@/components/app/module-gate'
import { NewProposalForm } from '@/components/proposals/new-proposal-form'
import { requireOrgContext } from '@/lib/auth/session'
import { clientOptions } from '@/lib/services/clients'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { integrationStatus } from '@/lib/env'

export const metadata: Metadata = { title: 'New proposal' }
export const maxDuration = 90

export default async function NewProposalPage() {
  const ctx = await requireOrgContext()
  const [ent, clients] = await Promise.all([getEntitlements(ctx.orgId), clientOptions(ctx)])
  return (
    <PageContainer>
      <PageHeader breadcrumbs={[{ label: 'Proposals', href: '/app/proposals' }, { label: 'New' }]} title="New proposal" description="Describe the engagement. AI drafts a complete proposal you can edit section by section." />
      <ModuleGate ent={ent} module="proposals">
        <NewProposalForm clients={clients} aiReady={integrationStatus().gemini} />
      </ModuleGate>
    </PageContainer>
  )
}
