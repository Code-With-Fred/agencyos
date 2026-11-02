import 'server-only'
import { sql } from 'kysely'
import { withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { assertCan } from '@/lib/auth/permissions'
import type { TenantContext } from '@/lib/auth/session'
import type { ClientInput } from '@/lib/validators/clients'
import { logActivity } from './activity'

export const PAGE_SIZE = 20

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export async function listClients(ctx: TenantContext, opts: { q: string; status: string; page: number }) {
  return withUser(ctx.userId, async (tx) => {
    let q = tx.selectFrom('clients').where('organization_id', '=', ctx.orgId)
    if (opts.status !== 'all') q = q.where('status', '=', opts.status as ClientInput['status'])
    if (opts.q) {
      const like = `%${escapeLike(opts.q)}%`
      q = q.where((eb) => eb.or([eb('name', 'ilike', like), eb('company', 'ilike', like), eb('email', 'ilike', like)]))
    }
    const [rows, total] = await Promise.all([
      q
        .select(['id', 'name', 'company', 'email', 'website', 'industry', 'country', 'status', 'created_at'])
        .select((eb) => [
          eb.selectFrom('projects').select(sql<number>`count(*)`.as('n')).whereRef('projects.client_id', '=', 'clients.id').as('projectCount'),
        ])
        .orderBy('created_at', 'desc')
        .limit(PAGE_SIZE)
        .offset((opts.page - 1) * PAGE_SIZE)
        .execute(),
      q.select(sql<number>`count(*)`.as('n')).executeTakeFirstOrThrow(),
    ])
    return { rows, total: Number(total.n), page: opts.page, pageSize: PAGE_SIZE }
  })
}

export async function clientOptions(ctx: TenantContext) {
  return withUser(ctx.userId, (tx) =>
    tx.selectFrom('clients').select(['id', 'name', 'company', 'email', 'website']).where('organization_id', '=', ctx.orgId).where('status', '!=', 'archived').orderBy('name').limit(500).execute(),
  )
}

export async function getClientDetail(ctx: TenantContext, id: string) {
  return withUser(ctx.userId, async (tx) => {
    const client = await tx.selectFrom('clients').selectAll().where('id', '=', id).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!client) throw new AppError('not_found', 'Client not found.')
    const [projects, audits, proposals, reports, kits] = await Promise.all([
      tx.selectFrom('projects').select(['id', 'name', 'status', 'deadline', 'budget', 'currency', 'updated_at']).where('client_id', '=', id).where('organization_id', '=', ctx.orgId).orderBy('created_at', 'desc').execute(),
      tx.selectFrom('website_audits').select(['id', 'url', 'status', 'overall_score', 'created_at']).where('client_id', '=', id).where('organization_id', '=', ctx.orgId).orderBy('created_at', 'desc').limit(50).execute(),
      tx.selectFrom('proposals').select(['id', 'title', 'status', 'total_amount', 'currency', 'updated_at']).where('client_id', '=', id).where('organization_id', '=', ctx.orgId).orderBy('created_at', 'desc').limit(50).execute(),
      tx.selectFrom('reports').select(['id', 'title', 'status', 'period_start', 'period_end', 'updated_at']).where('client_id', '=', id).where('organization_id', '=', ctx.orgId).orderBy('created_at', 'desc').limit(50).execute(),
      tx.selectFrom('onboarding_kits').select(['id', 'title', 'project_type', 'created_at']).where('client_id', '=', id).where('organization_id', '=', ctx.orgId).orderBy('created_at', 'desc').limit(50).execute(),
    ])
    return { client, projects, audits, proposals, reports, kits }
  })
}

export async function createClient(ctx: TenantContext, input: ClientInput) {
  assertCan(ctx.role, 'clients:write')
  return withUser(ctx.userId, async (tx) => {
    const row = await tx
      .insertInto('clients')
      .values({ organization_id: ctx.orgId, created_by: ctx.userId, ...input })
      .returning('id')
      .executeTakeFirstOrThrow()
    await logActivity(tx, ctx, { action: 'client.created', entityType: 'client', entityId: row.id, summary: `Added client ${input.name}` })
    return row.id
  })
}

export async function updateClient(ctx: TenantContext, id: string, input: ClientInput) {
  assertCan(ctx.role, 'clients:write')
  await withUser(ctx.userId, async (tx) => {
    const res = await tx.updateTable('clients').set(input).where('id', '=', id).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!res.numUpdatedRows) throw new AppError('not_found', 'Client not found.')
    await logActivity(tx, ctx, { action: 'client.updated', entityType: 'client', entityId: id, summary: `Updated client ${input.name}` })
  })
}

export async function deleteClient(ctx: TenantContext, id: string) {
  assertCan(ctx.role, 'clients:delete')
  await withUser(ctx.userId, async (tx) => {
    const row = await tx.deleteFrom('clients').where('id', '=', id).where('organization_id', '=', ctx.orgId).returning('name').executeTakeFirst()
    if (!row) throw new AppError('not_found', 'Client not found.')
    await logActivity(tx, ctx, { action: 'client.deleted', entityType: 'client', entityId: null, summary: `Deleted client ${row.name}` })
  })
}

export async function searchWorkspace(ctx: TenantContext, q: string) {
  const like = `%${escapeLike(q.trim().slice(0, 80))}%`
  if (q.trim().length < 2) return []
  return withUser(ctx.userId, async (tx) => {
    const [clients, projects, proposals, reports] = await Promise.all([
      tx.selectFrom('clients').select(['id', 'name as label']).where('organization_id', '=', ctx.orgId).where((eb) => eb.or([eb('name', 'ilike', like), eb('company', 'ilike', like)])).limit(5).execute(),
      tx.selectFrom('projects').select(['id', 'name as label']).where('organization_id', '=', ctx.orgId).where('name', 'ilike', like).limit(5).execute(),
      tx.selectFrom('proposals').select(['id', 'title as label']).where('organization_id', '=', ctx.orgId).where('title', 'ilike', like).limit(5).execute(),
      tx.selectFrom('reports').select(['id', 'title as label']).where('organization_id', '=', ctx.orgId).where('title', 'ilike', like).limit(5).execute(),
    ])
    return [
      ...clients.map((r) => ({ ...r, type: 'client' as const, href: `/app/clients/${r.id}` })),
      ...projects.map((r) => ({ ...r, type: 'project' as const, href: `/app/projects/${r.id}` })),
      ...proposals.map((r) => ({ ...r, type: 'proposal' as const, href: `/app/proposals/${r.id}` })),
      ...reports.map((r) => ({ ...r, type: 'report' as const, href: `/app/reports/${r.id}` })),
    ]
  })
}
