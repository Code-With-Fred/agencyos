import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Notice } from '@/components/ui/states'
import { StatusBadge } from '@/components/app/status'
import { ProposalEditor } from '@/components/proposals/proposal-editor'
import { requireOrgContext } from '@/lib/auth/session'
import { canEditOwned } from '@/lib/auth/permissions'
import { getProposal } from '@/lib/services/proposals'
import { clientOptions } from '@/lib/services/clients'
import { integrationStatus } from '@/lib/env'
import { AppError } from '@/lib/errors'
import { formatMoney, formatRelative } from '@/lib/utils'
import { uuid } from '@/lib/validators/common'

export const metadata: Metadata = { title: 'Proposal' }
export const maxDuration = 60

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext()
  const { id } = await params
  if (!uuid.safeParse(id).success) notFound()
  const { proposal, sections } = await getProposal(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === 'not_found') notFound()
    throw e
  })
  const clients = await clientOptions(ctx)
  const canEdit = canEditOwned(ctx.role, ctx.userId, proposal.created_by, 'proposals:edit_any')
  return (
    <PageContainer wide>
      <PageHeader
        breadcrumbs={[{ label: 'Proposals', href: '/app/proposals' }, { label: proposal.title }]}
        title={proposal.title}
        description={`${proposal.clientName ?? proposal.brief.clientName} · ${formatMoney(proposal.total_amount, proposal.currency)} · updated ${formatRelative(proposal.updated_at)}${proposal.createdByName ? ` · by ${proposal.createdByName}` : ''}`}
        actions={<StatusBadge status={proposal.status} />}
      />
      {!canEdit ? <Notice className="mb-4">You can view this proposal. Only its author or an admin can edit it.</Notice> : null}
      <ProposalEditor
        proposal={{ id: proposal.id, title: proposal.title, status: proposal.status, template: proposal.template, client_id: proposal.client_id, valid_until: proposal.valid_until, currency: proposal.currency, pricing_items: proposal.pricing_items }}
        sections={sections.map((s) => ({ key: s.key, title: s.title, content: s.content, ai_generated: s.ai_generated }))}
        clients={clients}
        canEdit={canEdit}
        aiReady={integrationStatus().gemini}
      />
    </PageContainer>
  )
}
