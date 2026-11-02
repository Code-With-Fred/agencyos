import type { Metadata } from 'next'
import Link from 'next/link'
import { LineChart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { EmptyState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { StatusBadge } from '@/components/app/status'
import { ModuleGate } from '@/components/app/module-gate'
import { NewReportDialog } from '@/components/reports/new-report'
import { requireOrgContext } from '@/lib/auth/session'
import { listReports, periodLabel } from '@/lib/services/reports'
import { clientOptions } from '@/lib/services/clients'
import { getBranding } from '@/lib/services/organizations'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { withUser } from '@/lib/db'
import { formatRelative } from '@/lib/utils'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const ent = await getEntitlements(ctx.orgId)
  const [rows, clients, { branding }, audits] = await Promise.all([
    listReports(ctx),
    clientOptions(ctx),
    getBranding(ctx),
    withUser(ctx.userId, (tx) => tx.selectFrom('website_audits').select(['id', 'url', 'client_id', 'created_at', 'overall_score']).where('organization_id', '=', ctx.orgId).where('status', '=', 'completed').orderBy('created_at', 'desc').limit(200).execute()),
  ])
  return (
    <PageContainer wide>
      <PageHeader
        title="Reports"
        description="White-label client reports built from audits, project progress and verified metrics."
        actions={ent.modules.includes('reports') ? <NewReportDialog clients={clients} audits={audits.map((a) => ({ ...a, created_at: a.created_at.toISOString() }))} defaultTitle={branding?.report_title_default || 'Monthly Performance Report'} defaultOpen={sp.new === '1'} /> : null}
      />
      <ModuleGate ent={ent} module="reports">
        {rows.length === 0 ? (
          <EmptyState icon={LineChart} title="No reports yet" description="Create a report for a client to combine your audit results, delivery progress and the metrics you track." />
        ) : (
          <Card>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Report</TH>
                  <TH>Client</TH>
                  <TH>Period</TH>
                  <TH>Status</TH>
                  <TH className="hidden md:table-cell">Share links</TH>
                  <TH className="hidden md:table-cell">Updated</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/app/reports/${r.id}`} className="font-medium text-fg hover:underline">
                        {r.title}
                      </Link>
                    </TD>
                    <TD>{r.clientName ?? '—'}</TD>
                    <TD className="whitespace-nowrap">{periodLabel(r.period_start, r.period_end)}</TD>
                    <TD>
                      <StatusBadge status={r.status} />
                    </TD>
                    <TD className="hidden tabular-nums md:table-cell">{Number(r.activeShares ?? 0)}</TD>
                    <TD className="hidden md:table-cell">{formatRelative(r.updated_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </ModuleGate>
    </PageContainer>
  )
}
