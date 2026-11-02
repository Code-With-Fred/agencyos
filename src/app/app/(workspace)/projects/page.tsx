import type { Metadata } from 'next'
import Link from 'next/link'
import { FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageContainer, PageHeader, Progress } from '@/components/ui/page'
import { EmptyState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { StatusBadge } from '@/components/app/status'
import { ModuleGate } from '@/components/app/module-gate'
import { ProjectDialog } from '@/components/projects/project-form'
import { requireOrgContext } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { listProjects } from '@/lib/services/projects'
import { clientOptions } from '@/lib/services/clients'
import { listMembers } from '@/lib/services/team'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { cn, formatDate, formatMoney } from '@/lib/utils'

export const metadata: Metadata = { title: 'Projects' }

const FILTERS = [
  ['all', 'All'],
  ['planning', 'Planning'],
  ['in_progress', 'In progress'],
  ['review', 'Review'],
  ['completed', 'Completed'],
  ['on_hold', 'On hold'],
]

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string; new?: string }> }) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const status = FILTERS.some(([k]) => k === sp.status) ? sp.status! : 'all'
  const ent = await getEntitlements(ctx.orgId)
  const canWrite = can(ctx.role, 'projects:write')
  const [projects, clients, members] = await Promise.all([listProjects(ctx, { status }), canWrite ? clientOptions(ctx) : [], canWrite ? listMembers(ctx) : []])

  return (
    <PageContainer wide>
      <PageHeader
        title="Projects"
        description={canWrite ? 'Track delivery across every client engagement.' : 'Projects you are assigned to.'}
        actions={
          canWrite ? (
            <ProjectDialog
              defaultOpen={sp.new === '1'}
              clients={clients}
              members={members}
              trigger={
                <Button size="sm">
                  <Plus /> New project
                </Button>
              }
            />
          ) : null
        }
      />
      <ModuleGate ent={ent} module="projects">
        <div className="mb-3 flex gap-1 overflow-x-auto scrollbar-thin">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={k === 'all' ? '/app/projects' : `/app/projects?status=${k}`} className={cn('rounded-md px-2.5 py-1 text-[13px]', status === k ? 'bg-hover text-fg' : 'text-fg-muted hover:text-fg')}>
              {label}
            </Link>
          ))}
        </div>
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects" description={canWrite ? 'Create a project to plan delivery, assign your team and track tasks.' : 'You have not been assigned to any projects yet.'} />
        ) : (
          <Card>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Project</TH>
                  <TH>Client</TH>
                  <TH>Status</TH>
                  <TH className="w-40">Progress</TH>
                  <TH className="hidden md:table-cell">Deadline</TH>
                  <TH className="hidden lg:table-cell">Budget</TH>
                </TR>
              </THead>
              <TBody>
                {projects.map((p) => {
                  const total = Number(p.taskCount ?? 0)
                  const done = Number(p.doneCount ?? 0)
                  return (
                    <TR key={p.id}>
                      <TD>
                        <Link href={`/app/projects/${p.id}`} className="font-medium text-fg hover:underline">
                          {p.name}
                        </Link>
                      </TD>
                      <TD>{p.clientId ? <Link href={`/app/clients/${p.clientId}`} className="hover:text-fg">{p.clientName}</Link> : '—'}</TD>
                      <TD>
                        <StatusBadge status={p.status} />
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Progress value={total ? (done / total) * 100 : 0} />
                          <span className="w-10 text-right text-xs tabular-nums">{total ? `${done}/${total}` : '—'}</span>
                        </div>
                      </TD>
                      <TD className="hidden md:table-cell">{formatDate(p.deadline)}</TD>
                      <TD className="hidden lg:table-cell">{formatMoney(p.budget, p.currency)}</TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </Card>
        )}
      </ModuleGate>
    </PageContainer>
  )
}
