import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, PageContainer, PageHeader, Progress } from '@/components/ui/page'
import { StatusBadge } from '@/components/app/status'
import { ProjectDialog } from '@/components/projects/project-form'
import { DeleteProjectButton } from '@/components/projects/project-actions'
import { TaskList } from '@/components/projects/tasks'
import { requireOrgContext } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getProjectDetail } from '@/lib/services/projects'
import { clientOptions } from '@/lib/services/clients'
import { AppError } from '@/lib/errors'
import { formatDate, formatMoney } from '@/lib/utils'
import { uuid } from '@/lib/validators/common'

export const metadata: Metadata = { title: 'Project' }

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext()
  const { id } = await params
  if (!uuid.safeParse(id).success) notFound()
  const data = await getProjectDetail(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === 'not_found') notFound()
    throw e
  })
  const { project, tasks, members, orgMembers } = data
  const isAdmin = can(ctx.role, 'projects:write')
  const clients = isAdmin ? await clientOptions(ctx) : []
  const done = tasks.filter((t) => t.status === 'done').length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const overdue = project.deadline && project.status !== 'completed' && new Date(`${project.deadline}T23:59:59`) < new Date()

  return (
    <PageContainer wide>
      <PageHeader
        breadcrumbs={[{ label: 'Projects', href: '/app/projects' }, { label: project.name }]}
        title={project.name}
        description={project.clientName ? `Client: ${project.clientName}` : undefined}
        actions={
          isAdmin ? (
            <>
              <ProjectDialog
                project={{ ...project, memberIds: members.map((m) => m.userId) }}
                clients={clients}
                members={orgMembers}
                trigger={
                  <Button variant="secondary" size="sm">
                    <Pencil /> Edit
                  </Button>
                }
              />
              <DeleteProjectButton id={project.id} name={project.name} />
            </>
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Tasks</CardTitle>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {done} of {tasks.length} complete
                </p>
              </div>
              <div className="w-32">
                <Progress value={pct} />
              </div>
            </CardHeader>
            <TaskList projectId={project.id} tasks={tasks} members={orgMembers} userId={ctx.userId} isAdmin={isAdmin} />
          </Card>
          {project.description ? (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">{project.description}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <StatusBadge status={project.status} />
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-fg-subtle">Client</dt>
                  <dd>{project.client_id ? <Link href={`/app/clients/${project.client_id}`} className="text-fg hover:underline">{project.clientName}</Link> : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-subtle">Deadline</dt>
                  <dd className={overdue ? 'text-danger' : 'text-fg'}>{formatDate(project.deadline)}{overdue ? ' · overdue' : ''}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-subtle">Budget</dt>
                  <dd className="text-fg">{formatMoney(project.budget, project.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-subtle">Completion</dt>
                  <dd className="tabular-nums text-fg">{pct}%</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {members.length === 0 ? <p className="text-[13px] text-fg-muted">No members assigned.</p> : null}
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2.5">
                  <Avatar name={m.name} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-fg">{m.name}</p>
                    <p className="truncate text-2xs text-fg-subtle">{m.email}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {project.internal_notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Internal notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">{project.internal_notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </PageContainer>
  )
}
