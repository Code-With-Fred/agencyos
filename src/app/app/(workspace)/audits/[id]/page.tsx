import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { ErrorState } from '@/components/ui/states'
import { AuditReport } from '@/components/audits/audit-report'
import { AuditActions } from '@/components/audits/audit-actions'
import { requireOrgContext } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getAudit } from '@/lib/services/audits'
import { integrationStatus } from '@/lib/env'
import { AppError } from '@/lib/errors'
import { formatDateTime } from '@/lib/utils'
import { uuid } from '@/lib/validators/common'

export const metadata: Metadata = { title: 'Audit report' }

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext()
  const { id } = await params
  if (!uuid.safeParse(id).success) notFound()
  const audit = await getAudit(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === 'not_found') notFound()
    throw e
  })
  const host = new URL(audit.final_url ?? audit.url).host
  const completed = audit.status === 'completed' && audit.findings && audit.issues && audit.category_scores && audit.overall_score !== null

  return (
    <PageContainer wide>
      <PageHeader
        breadcrumbs={[{ label: 'Website audits', href: '/app/audits' }, { label: host }]}
        title={host}
        description={`${audit.clientName ? `${audit.clientName} · ` : ''}Run ${formatDateTime(audit.created_at)}${audit.createdByName ? ` by ${audit.createdByName}` : ''} · rules v${audit.rules_version}`}
        actions={<AuditActions id={audit.id} url={audit.url} clientId={audit.client_id} completed={Boolean(completed)} canDelete={can(ctx.role, 'audits:delete')} aiReady={integrationStatus().gemini} />}
      />
      {completed ? (
        <AuditReport overall={audit.overall_score!} categories={audit.category_scores!} issues={audit.issues!} findings={audit.findings!} ai={audit.ai_analysis} aiStatus={audit.ai_status} aiError={audit.ai_error} />
      ) : audit.status === 'failed' ? (
        <ErrorState title="The audit could not be completed" description={audit.error ?? 'Unknown error'} />
      ) : (
        <ErrorState title="Audit still running or interrupted" description="This audit has not finished. If it was interrupted, run it again from the audits page." />
      )}
    </PageContainer>
  )
}
