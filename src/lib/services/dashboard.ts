import 'server-only'
import { sql } from 'kysely'
import { withUser } from '@/lib/db'
import type { TenantContext } from '@/lib/auth/session'
import { monthlyUsage } from '@/lib/licensing/entitlements'

export async function getDashboard(ctx: TenantContext) {
  return withUser(ctx.userId, async (tx) => {
    const count = (table: 'clients' | 'projects' | 'website_audits' | 'proposals' | 'reports') =>
      tx.selectFrom(table).select(sql<number>`count(*)`.as('n')).where('organization_id', '=', ctx.orgId).executeTakeFirstOrThrow().then((r) => Number(r.n))

    const since = new Date(Date.now() - 29 * 86400_000)
    since.setUTCHours(0, 0, 0, 0)

    const [clients, projects, audits, proposals, reports, activeProjects, activity, recentReports, recentAudits, aiDaily, auditDaily, usage] = await Promise.all([
      count('clients'),
      count('projects'),
      count('website_audits'),
      count('proposals'),
      count('reports'),
      tx.selectFrom('projects').select(sql<number>`count(*)`.as('n')).where('organization_id', '=', ctx.orgId).where('status', 'in', ['planning', 'in_progress', 'review']).executeTakeFirstOrThrow().then((r) => Number(r.n)),
      tx
        .selectFrom('activity_logs as a')
        .leftJoin('user as u', 'u.id', 'a.actor_id')
        .select(['a.id', 'a.summary', 'a.entity_type', 'a.entity_id', 'a.created_at', 'u.name as actorName'])
        .where('a.organization_id', '=', ctx.orgId)
        .orderBy('a.created_at', 'desc')
        .limit(8)
        .execute(),
      tx
        .selectFrom('reports as r')
        .leftJoin('clients as c', 'c.id', 'r.client_id')
        .select(['r.id', 'r.title', 'r.status', 'r.updated_at', 'c.name as clientName'])
        .where('r.organization_id', '=', ctx.orgId)
        .orderBy('r.updated_at', 'desc')
        .limit(5)
        .execute(),
      tx.selectFrom('website_audits').select(['id', 'url', 'status', 'overall_score', 'created_at']).where('organization_id', '=', ctx.orgId).orderBy('created_at', 'desc').limit(5).execute(),
      tx
        .selectFrom('ai_usage_logs')
        .select([sql<string>`to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`.as('day'), sql<number>`count(*)`.as('n'), sql<number>`coalesce(sum(total_tokens), 0)`.as('tokens')])
        .where('organization_id', '=', ctx.orgId)
        .where('created_at', '>=', since)
        .where('status', '=', 'success')
        .groupBy(sql`date_trunc('day', created_at)`)
        .execute(),
      tx
        .selectFrom('website_audits')
        .select([sql<string>`to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`.as('day'), sql<number>`count(*)`.as('n')])
        .where('organization_id', '=', ctx.orgId)
        .where('created_at', '>=', since)
        .groupBy(sql`date_trunc('day', created_at)`)
        .execute(),
      monthlyUsage(tx, ctx.orgId),
    ])

    const aiMap = new Map(aiDaily.map((r) => [r.day, Number(r.n)]))
    const auditMap = new Map(auditDaily.map((r) => [r.day, Number(r.n)]))
    const series = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since.getTime() + i * 86400_000)
      const key = d.toISOString().slice(0, 10)
      return { day: key, ai: aiMap.get(key) ?? 0, audits: auditMap.get(key) ?? 0 }
    })

    return { counts: { clients, projects, activeProjects, audits, proposals, reports }, activity, recentReports, recentAudits, series, usage }
  })
}

export async function getNotifications(ctx: TenantContext) {
  return withUser(ctx.userId, (tx) =>
    tx
      .selectFrom('activity_logs as a')
      .leftJoin('user as u', 'u.id', 'a.actor_id')
      .select(['a.id', 'a.summary', 'a.created_at', 'a.actor_id', 'u.name as actorName'])
      .where('a.organization_id', '=', ctx.orgId)
      .where('a.actor_id', 'is distinct from', ctx.userId)
      .orderBy('a.created_at', 'desc')
      .limit(12)
      .execute(),
  )
}
