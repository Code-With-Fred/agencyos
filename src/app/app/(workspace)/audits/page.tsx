import type { Metadata } from 'next'
import Link from 'next/link'
import { ScanSearch } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { EmptyState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { ScorePill, StatusBadge } from '@/components/app/status'
import { Pagination } from '@/components/app/pagination'
import { ModuleGate } from '@/components/app/module-gate'
import { NewAudit } from '@/components/audits/new-audit'
import { requireOrgContext } from '@/lib/auth/session'
import { listAudits } from '@/lib/services/audits'
import { clientOptions } from '@/lib/services/clients'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { integrationStatus } from '@/lib/env'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Website audits' }

export default async function AuditsPage({ searchParams }: { searchParams: Promise<{ page?: string; client?: string; new?: string; url?: string }> }) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const page = Math.max(1, Math.min(10000, Number(sp.page) || 1))
  const ent = await getEntitlements(ctx.orgId)
  const [data, clients] = await Promise.all([listAudits(ctx, page), clientOptions(ctx)])
  const integ = integrationStatus()

  return (
    <PageContainer wide>
      <PageHeader title="Website audits" description="Measured technical SEO, content, performance, accessibility and UX checks with AI explanations." />
      <ModuleGate ent={ent} module="audits">
        <div className="space-y-6">
          <NewAudit clients={clients} defaultClientId={sp.client} defaultUrl={sp.url?.slice(0, 2048)} pagespeed={integ.pagespeed} ai={integ.gemini} autoFocus={sp.new === '1'} />
          <Card>
            <CardHeader>
              <CardTitle>Audit history</CardTitle>
            </CardHeader>
            {data.rows.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={ScanSearch} title="No audits yet" description="Run your first audit above. Every result is saved here with its findings and AI analysis." />
              </div>
            ) : (
              <>
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Website</TH>
                      <TH>Client</TH>
                      <TH>Score</TH>
                      <TH>Status</TH>
                      <TH className="hidden md:table-cell">AI analysis</TH>
                      <TH className="hidden md:table-cell">Run</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.rows.map((a) => (
                      <TR key={a.id}>
                        <TD className="max-w-xs">
                          <Link href={`/app/audits/${a.id}`} className="block truncate font-medium text-fg hover:underline">
                            {(a.final_url ?? a.url).replace(/^https?:\/\//, '')}
                          </Link>
                          {a.status === 'failed' && a.error ? <p className="truncate text-xs text-danger/80">{a.error}</p> : null}
                        </TD>
                        <TD>{a.clientName ?? '—'}</TD>
                        <TD>
                          <ScorePill score={a.overall_score} />
                        </TD>
                        <TD>
                          <StatusBadge status={a.status} />
                        </TD>
                        <TD className="hidden capitalize md:table-cell">{a.ai_status}</TD>
                        <TD className="hidden whitespace-nowrap md:table-cell">{formatDateTime(a.created_at)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={(p) => `/app/audits?page=${p}`} />
              </>
            )}
          </Card>
        </div>
      </ModuleGate>
    </PageContainer>
  )
}
