import 'server-only'
import { sql } from 'kysely'
import { withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { assertCan, can } from '@/lib/auth/permissions'
import type { TenantContext } from '@/lib/auth/session'
import type { ProjectInput } from '@/lib/validators/clients'
import type { ProjectStatus, TaskStatus } from '@/lib/db/types'
import { logActivity } from './activity'

/** RLS already hides unassigned projects from members; queries stay explicit too. */
export async function listProjects(ctx: TenantContext, opts: { status?: string; clientId?: string } = {}) {
  return withUser(ctx.userId, (tx) => {
    let q = tx
      .selectFrom('projects as p')
      .leftJoin('clients as c', 'c.id', 'p.client_id')
      .select(['p.id', 'p.name', 'p.status', 'p.deadline', 'p.budget', 'p.currency', 'p.updated_at', 'c.name as clientName', 'c.id as clientId'])
      .select((eb) => [
        eb.selectFrom('project_tasks as t').select(sql<number>`count(*)`.as('n')).whereRef('t.project_id', '=', 'p.id').as('taskCount'),
        eb.selectFrom('project_tasks as t').select(sql<number>`count(*)`.as('n')).whereRef('t.project_id', '=', 'p.id').where('t.status', '=', 'done').as('doneCount'),
      ])
      .where('p.organization_id', '=', ctx.orgId)
    if (opts.status && opts.status !== 'all') q = q.where('p.status', '=', opts.status as ProjectStatus)
    if (opts.clientId) q = q.where('p.client_id', '=', opts.clientId)
    if (!can(ctx.role, 'projects:read_all')) {
      q = q.where((eb) => eb.exists(eb.selectFrom('project_members as pm').select('pm.user_id').whereRef('pm.project_id', '=', 'p.id').where('pm.user_id', '=', ctx.userId)))
    }
    return q.orderBy('p.updated_at', 'desc').limit(200).execute()
  })
}

export async function getProjectDetail(ctx: TenantContext, id: string) {
  return withUser(ctx.userId, async (tx) => {
    const project = await tx
      .selectFrom('projects as p')
      .leftJoin('clients as c', 'c.id', 'p.client_id')
      .selectAll('p')
      .select(['c.name as clientName'])
      .where('p.id', '=', id)
      .where('p.organization_id', '=', ctx.orgId)
      .executeTakeFirst()
    if (!project) throw new AppError('not_found', 'Project not found or not assigned to you.')
    const [tasks, members, orgMembers] = await Promise.all([
      tx
        .selectFrom('project_tasks as t')
        .leftJoin('user as u', 'u.id', 't.assignee_id')
        .select(['t.id', 't.title', 't.description', 't.status', 't.due_date', 't.assignee_id', 't.created_by', 't.completed_at', 'u.name as assigneeName'])
        .where('t.project_id', '=', id)
        .orderBy('t.position')
        .orderBy('t.created_at')
        .execute(),
      tx.selectFrom('project_members as pm').innerJoin('user as u', 'u.id', 'pm.user_id').select(['pm.user_id as userId', 'u.name', 'u.email']).where('pm.project_id', '=', id).execute(),
      tx.selectFrom('organization_members as m').innerJoin('user as u', 'u.id', 'm.user_id').select(['m.user_id as userId', 'u.name', 'm.role']).where('m.organization_id', '=', ctx.orgId).orderBy('u.name').execute(),
    ])
    return { project, tasks, members, orgMembers }
  })
}

async function assertSameOrgUsers(tx: Parameters<Parameters<typeof withUser>[1]>[0], orgId: string, userIds: string[]) {
  if (!userIds.length) return
  const rows = await tx.selectFrom('organization_members').select('user_id').where('organization_id', '=', orgId).where('user_id', 'in', userIds).execute()
  if (rows.length !== new Set(userIds).size) throw new AppError('validation', 'One or more selected people are not members of this organization.')
}

export async function createProject(ctx: TenantContext, input: ProjectInput, memberIds: string[]) {
  assertCan(ctx.role, 'projects:write')
  return withUser(ctx.userId, async (tx) => {
    await assertSameOrgUsers(tx, ctx.orgId, memberIds)
    const row = await tx
      .insertInto('projects')
      .values({
        organization_id: ctx.orgId,
        client_id: input.clientId,
        name: input.name,
        description: input.description,
        status: input.status,
        deadline: input.deadline,
        budget: input.budget,
        currency: input.currency,
        internal_notes: input.internalNotes,
        created_by: ctx.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    if (memberIds.length) {
      await tx.insertInto('project_members').values([...new Set(memberIds)].map((u) => ({ project_id: row.id, organization_id: ctx.orgId, user_id: u }))).execute()
    }
    await logActivity(tx, ctx, { action: 'project.created', entityType: 'project', entityId: row.id, summary: `Created project ${input.name}` })
    return row.id
  })
}

export async function updateProject(ctx: TenantContext, id: string, input: ProjectInput, memberIds: string[]) {
  assertCan(ctx.role, 'projects:write')
  await withUser(ctx.userId, async (tx) => {
    await assertSameOrgUsers(tx, ctx.orgId, memberIds)
    const res = await tx
      .updateTable('projects')
      .set({ client_id: input.clientId, name: input.name, description: input.description, status: input.status, deadline: input.deadline, budget: input.budget, currency: input.currency, internal_notes: input.internalNotes })
      .where('id', '=', id)
      .where('organization_id', '=', ctx.orgId)
      .executeTakeFirst()
    if (!res.numUpdatedRows) throw new AppError('not_found', 'Project not found.')
    await tx.deleteFrom('project_members').where('project_id', '=', id).where('organization_id', '=', ctx.orgId).execute()
    if (memberIds.length) {
      await tx.insertInto('project_members').values([...new Set(memberIds)].map((u) => ({ project_id: id, organization_id: ctx.orgId, user_id: u }))).execute()
    }
    await logActivity(tx, ctx, { action: 'project.updated', entityType: 'project', entityId: id, summary: `Updated project ${input.name}` })
  })
}

export async function deleteProject(ctx: TenantContext, id: string) {
  assertCan(ctx.role, 'projects:delete')
  await withUser(ctx.userId, async (tx) => {
    const row = await tx.deleteFrom('projects').where('id', '=', id).where('organization_id', '=', ctx.orgId).returning('name').executeTakeFirst()
    if (!row) throw new AppError('not_found', 'Project not found.')
    await logActivity(tx, ctx, { action: 'project.deleted', entityType: 'project', summary: `Deleted project ${row.name}` })
  })
}

export async function addTask(ctx: TenantContext, projectId: string, input: { title: string; description: string | null; assigneeId: string | null; dueDate: string | null }) {
  return withUser(ctx.userId, async (tx) => {
    const project = await tx.selectFrom('projects').select(['id', 'name']).where('id', '=', projectId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!project) throw new AppError('not_found', 'Project not found or not assigned to you.')
    if (input.assigneeId) await assertSameOrgUsers(tx, ctx.orgId, [input.assigneeId])
    const pos = await tx.selectFrom('project_tasks').select(sql<number>`coalesce(max(position), 0) + 1`.as('p')).where('project_id', '=', projectId).executeTakeFirstOrThrow()
    const row = await tx
      .insertInto('project_tasks')
      .values({ organization_id: ctx.orgId, project_id: projectId, title: input.title, description: input.description, assignee_id: input.assigneeId, due_date: input.dueDate, position: Number(pos.p), created_by: ctx.userId })
      .returning('id')
      .executeTakeFirstOrThrow()
    await logActivity(tx, ctx, { action: 'task.created', entityType: 'project', entityId: projectId, summary: `Added task "${input.title}" to ${project.name}` })
    return row.id
  })
}

export async function setTaskStatus(ctx: TenantContext, taskId: string, status: TaskStatus) {
  await withUser(ctx.userId, async (tx) => {
    const res = await tx
      .updateTable('project_tasks')
      .set({ status, completed_at: status === 'done' ? new Date() : null })
      .where('id', '=', taskId)
      .where('organization_id', '=', ctx.orgId)
      .returning(['title', 'project_id'])
      .executeTakeFirst()
    if (!res) throw new AppError('not_found', 'Task not found.')
    if (status === 'done') await logActivity(tx, ctx, { action: 'task.completed', entityType: 'project', entityId: res.project_id, summary: `Completed task "${res.title}"` })
  })
}

export async function deleteTask(ctx: TenantContext, taskId: string) {
  await withUser(ctx.userId, async (tx) => {
    const res = await tx.deleteFrom('project_tasks').where('id', '=', taskId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!res.numDeletedRows) throw new AppError('forbidden', 'You can only delete tasks you created, unless you are an admin.')
  })
}
