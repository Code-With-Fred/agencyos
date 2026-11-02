import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Notice } from '@/components/ui/states'
import { StatusBadge } from '@/components/app/status'
import { ReportEditor } from '@/components/reports/report-editor'
import { requireOrgContext } from '@/lib/auth/session'
import { can, canEditOwned } from '@/lib/auth/permissions'
import { getReport, periodLabel } from '@/lib/services/reports'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { integrationStatus } from '@/lib/env'
import { withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { uuid } from '@/lib/validators/common'

export const metadata: Metadata = { title: 'Report' }
export const maxDuration = 60

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext()
  const { id } = await params
  if (!uuid.safeParse(id).success) notFound()
  const { report, sections, shares } = await getReport(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === 'not_found') notFound()
    throw e
  })
  const [ent, audits] = await Promise.all([
    getEntitlements(ctx.orgId),
    withUser(ctx.userId, (tx) => {
      let q = tx.selectFrom('website_audits').select(['id', 'url', 'overall_score', 'created_at']).where('organization_id', '=', ctx.orgId).where('status', '=', 'completed')
      if (report.client_id) q = q.where('client_id', '=', report.client_id)
      return q.orderBy('created_at', 'desc').limit(100).execute()
    }),
  ])
  const canEdit = canEditOwned(ctx.role, ctx.userId, report.created_by, 'reports:edit_any')
  return (
    <PageContainer wide>
      <PageHeader breadcrumbs={[{ label: 'Reports', href: '/app/reports' }, { label: report.title }]} title={report.title} description={`${report.clientName ?? 'No client'} · ${periodLabel(report.period_start, report.period_end)}`} actions={<StatusBadge status={report.status} />} />
      {!ent.whiteLabel ? <Notice className="mb-4">Your {ent.name} plan includes an “AgencyOS AI” attribution in exported and shared reports. White-label reports are available on the Agency plan.</Notice> : null}
      {!canEdit ? <Notice className="mb-4">You can view this report. Only its author or an admin can edit it.</Notice> : null}
      <ReportEditor
        report={{ id: report.id, title: report.title, template: report.template, status: report.status, period_start: report.period_start, period_end: report.period_end, audit_id: report.audit_id, metrics: report.metrics.map((m) => ({ ...m, previous: m.previous ?? '', unit: m.unit ?? '', note: m.note ?? '', verified: true })) }}
        sections={sections.map((s) => ({ id: s.id, kind: s.kind, title: s.title, content: s.content, enabled: s.enabled, ai_generated: s.ai_generated }))}
        shares={shares.map((s) => ({ ...s, expires_at: s.expires_at?.toISOString() ?? null, revoked_at: s.revoked_at?.toISOString() ?? null, last_viewed_at: s.last_viewed_at?.toISOString() ?? null, created_at: s.created_at.toISOString() }))}
        audits={audits.map((a) => ({ ...a, created_at: a.created_at.toISOString() }))}
        canEdit={canEdit}
        canShare={can(ctx.role, 'reports:share')}
        aiReady={integrationStatus().gemini}
      />
    </PageContainer>
  )
}
