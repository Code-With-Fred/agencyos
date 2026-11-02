import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { EmptyState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { StatusBadge } from '@/components/app/status'
import { Pagination } from '@/components/app/pagination'
import { ModuleGate } from '@/components/app/module-gate'
import { ClientDialog } from '@/components/clients/client-form'
import { requireOrgContext } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { listClients } from '@/lib/services/clients'
import { clientListSchema } from '@/lib/validators/clients'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const filters = clientListSchema.parse({ q: sp.q, status: sp.status, page: sp.page })
  const ent = await getEntitlements(ctx.orgId)
  const canWrite = can(ctx.role, 'clients:write')
  const data = ent.modules.includes('clients') ? await listClients(ctx, filters) : null
  const qs = (p: number) => `/app/clients?${new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), ...(filters.status !== 'all' ? { status: filters.status } : {}), page: String(p) })}`

  return (
    <PageContainer wide>
      <PageHeader
        title="Clients"
        description="Every client your agency works with, and everything you have delivered for them."
        actions={
          canWrite ? (
            <ClientDialog
              defaultOpen={sp.new === '1'}
              trigger={
                <Button size="sm">
                  <Plus /> Add client
                </Button>
              }
            />
          ) : null
        }
      />
      <ModuleGate ent={ent} module="clients">
        <Card>
          <form className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row" role="search">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
              <Input name="q" defaultValue={filters.q} placeholder="Search by name, company or email" className="pl-8" aria-label="Search clients" />
            </div>
            <NativeSelect name="status" defaultValue={filters.status} className="sm:w-40" aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </NativeSelect>
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </form>
          {data && data.rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Building2}
                title={filters.q || filters.status !== 'all' ? 'No clients match your filters' : 'No clients yet'}
                description={filters.q || filters.status !== 'all' ? 'Try a different search or clear the filters.' : 'Add your first client to start running audits, proposals and reports for them.'}
              />
            </div>
          ) : data ? (
            <>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Client</TH>
                    <TH>Email</TH>
                    <TH className="hidden md:table-cell">Industry</TH>
                    <TH className="hidden lg:table-cell">Country</TH>
                    <TH>Projects</TH>
                    <TH>Status</TH>
                    <TH className="hidden md:table-cell">Added</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.rows.map((c) => (
                    <TR key={c.id}>
                      <TD>
                        <Link href={`/app/clients/${c.id}`} className="font-medium text-fg hover:underline">
                          {c.name}
                        </Link>
                        {c.company ? <p className="text-xs text-fg-subtle">{c.company}</p> : null}
                      </TD>
                      <TD>{c.email ?? '—'}</TD>
                      <TD className="hidden md:table-cell">{c.industry ?? '—'}</TD>
                      <TD className="hidden lg:table-cell">{c.country ?? '—'}</TD>
                      <TD className="tabular-nums">{Number(c.projectCount ?? 0)}</TD>
                      <TD>
                        <StatusBadge status={c.status} />
                      </TD>
                      <TD className="hidden md:table-cell">{formatDate(c.created_at)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={qs} />
            </>
          ) : null}
        </Card>
      </ModuleGate>
    </PageContainer>
  )
}
