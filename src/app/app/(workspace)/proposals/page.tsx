import type { Metadata } from 'next'
import Link from 'next/link'
import { FileSignature, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { EmptyState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { StatusBadge } from '@/components/app/status'
import { ModuleGate } from '@/components/app/module-gate'
import { requireOrgContext } from '@/lib/auth/session'
import { listProposals } from '@/lib/services/proposals'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { cn, formatMoney, formatRelative } from '@/lib/utils'

export const metadata: Metadata = { title: 'Proposals' }
const FILTERS = ['all', 'draft', 'sent', 'accepted', 'declined', 'archived']

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const status = FILTERS.includes(sp.status ?? '') ? sp.status! : 'all'
  const [ent, rows] = await Promise.all([getEntitlements(ctx.orgId), listProposals(ctx, status)])
  return (
    <PageContainer wide>
      <PageHeader
        title="Proposals"
        description="Structured, editable client proposals drafted from your project brief."
        actions={
          <Button asChild size="sm">
            <Link href="/app/proposals/new">
              <Plus /> New proposal
            </Link>
          </Button>
        }
      />
      <ModuleGate ent={ent} module="proposals">
        <div className="mb-3 flex gap-1 overflow-x-auto scrollbar-thin">
          {FILTERS.map((f) => (
            <Link key={f} href={f === 'all' ? '/app/proposals' : `/app/proposals?status=${f}`} className={cn('rounded-md px-2.5 py-1 text-[13px] capitalize', status === f ? 'bg-hover text-fg' : 'text-fg-muted hover:text-fg')}>
              {f}
            </Link>
          ))}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={FileSignature} title="No proposals" description="Create a proposal from a project brief. AI drafts every section; you edit and export." action={<Button asChild size="sm"><Link href="/app/proposals/new">New proposal</Link></Button>} />
        ) : (
          <Card>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Proposal</TH>
                  <TH>Client</TH>
                  <TH>Status</TH>
                  <TH>Value</TH>
                  <TH className="hidden md:table-cell">Author</TH>
                  <TH className="hidden md:table-cell">Updated</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link href={`/app/proposals/${p.id}`} className="font-medium text-fg hover:underline">
                        {p.title}
                      </Link>
                      <p className="text-xs capitalize text-fg-subtle">{p.template} template</p>
                    </TD>
                    <TD>{p.clientName ?? '—'}</TD>
                    <TD>
                      <StatusBadge status={p.status} />
                    </TD>
                    <TD className="tabular-nums">{formatMoney(p.total_amount, p.currency)}</TD>
                    <TD className="hidden md:table-cell">{p.authorName ?? '—'}</TD>
                    <TD className="hidden md:table-cell">{formatRelative(p.updated_at)}</TD>
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
