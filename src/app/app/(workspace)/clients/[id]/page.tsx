import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, Mail, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { StatusBadge, ScorePill } from '@/components/app/status'
import { ClientActions } from '@/components/clients/client-actions'
import { requireOrgContext } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getClientDetail } from '@/lib/services/clients'
import { AppError } from '@/lib/errors'
import { formatDate, formatMoney, formatRelative } from '@/lib/utils'
import { uuid } from '@/lib/validators/common'

export const metadata: Metadata = { title: 'Client' }

function List<T extends { id: string }>({ rows, empty, cols, render, newHref, newLabel }: { rows: T[]; empty: string; cols: string[]; render: (r: T) => React.ReactNode[]; newHref?: string; newLabel?: string }) {
  return (
    <Card>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-fg-muted">
          {empty}{' '}
          {newHref ? (
            <Link href={newHref} className="text-accent">
              {newLabel}
            </Link>
          ) : null}
        </p>
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              {cols.map((c) => (
                <TH key={c}>{c}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                {render(r).map((cell, i) => (
                  <TD key={i}>{cell}</TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  )
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext()
  const { id } = await params
  if (!uuid.safeParse(id).success) notFound()
  const data = await getClientDetail(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === 'not_found') notFound()
    throw e
  })
  const { client } = data
  const link = (href: string, label: string) => (
    <Link href={href} className="font-medium text-fg hover:underline">
      {label}
    </Link>
  )

  return (
    <PageContainer wide>
      <PageHeader
        breadcrumbs={[{ label: 'Clients', href: '/app/clients' }, { label: client.name }]}
        title={client.name}
        description={client.company ?? undefined}
        actions={<ClientActions client={client} canEdit={can(ctx.role, 'clients:write')} canDelete={can(ctx.role, 'clients:delete')} />}
      />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects ({data.projects.length})</TabsTrigger>
          <TabsTrigger value="audits">Audits ({data.audits.length})</TabsTrigger>
          <TabsTrigger value="proposals">Proposals ({data.proposals.length})</TabsTrigger>
          <TabsTrigger value="reports">Reports ({data.reports.length})</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding ({data.kits.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Details</CardTitle>
                <StatusBadge status={client.status} />
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    ['Email', client.email ? <a key="e" href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-fg"><Mail className="size-3.5" />{client.email}</a> : '—'],
                    ['Phone', client.phone ? <a key="p" href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 hover:text-fg"><Phone className="size-3.5" />{client.phone}</a> : '—'],
                    ['Website', client.website ? <a key="w" href={client.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 hover:text-fg">{client.website.replace(/^https?:\/\//, '')}<ExternalLink className="size-3" /></a> : '—'],
                    ['Industry', client.industry ?? '—'],
                    ['Country', client.country ?? '—'],
                    ['Client since', formatDate(client.created_at)],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <dt className="text-xs text-fg-subtle">{k}</dt>
                      <dd className="mt-1 text-[13px] text-fg-muted">{v}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Internal notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">{client.notes || 'No notes yet.'}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="projects">
          <List rows={data.projects} empty="No projects for this client." newHref="/app/projects?new=1" newLabel="Create a project" cols={['Project', 'Status', 'Deadline', 'Budget']} render={(p) => [link(`/app/projects/${p.id}`, p.name), <StatusBadge key="s" status={p.status} />, formatDate(p.deadline), formatMoney(p.budget, p.currency)]} />
        </TabsContent>
        <TabsContent value="audits">
          <List rows={data.audits} empty="No audits for this client." newHref="/app/audits?new=1" newLabel="Run an audit" cols={['URL', 'Score', 'Status', 'Run']} render={(a) => [link(`/app/audits/${a.id}`, a.url.replace(/^https?:\/\//, '')), <ScorePill key="sc" score={a.overall_score} />, <StatusBadge key="s" status={a.status} />, formatRelative(a.created_at)]} />
        </TabsContent>
        <TabsContent value="proposals">
          <List rows={data.proposals} empty="No proposals for this client." newHref="/app/proposals/new" newLabel="Create a proposal" cols={['Proposal', 'Status', 'Value', 'Updated']} render={(p) => [link(`/app/proposals/${p.id}`, p.title), <StatusBadge key="s" status={p.status} />, formatMoney(p.total_amount, p.currency), formatRelative(p.updated_at)]} />
        </TabsContent>
        <TabsContent value="reports">
          <List rows={data.reports} empty="No reports for this client." newHref="/app/reports?new=1" newLabel="Create a report" cols={['Report', 'Status', 'Period', 'Updated']} render={(r) => [link(`/app/reports/${r.id}`, r.title), <StatusBadge key="s" status={r.status} />, r.period_start ? `${formatDate(r.period_start)} – ${formatDate(r.period_end)}` : '—', formatRelative(r.updated_at)]} />
        </TabsContent>
        <TabsContent value="onboarding">
          <List rows={data.kits} empty="No onboarding documents for this client." newHref="/app/onboarding?new=1" newLabel="Generate onboarding documents" cols={['Onboarding kit', 'Project type', 'Created']} render={(k) => [link(`/app/onboarding/${k.id}`, k.title), k.project_type, formatDate(k.created_at)]} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
