import 'server-only'
import { sql } from 'kysely'
import { json, withSystem, withUser, type Tx } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { assertCan, canEditOwned } from '@/lib/auth/permissions'
import type { TenantContext } from '@/lib/auth/session'
import type { ReportSectionKind } from '@/lib/db/types'
import { assertModule, getEntitlements } from '@/lib/licensing/entitlements'
import { generateStructured } from '@/lib/ai/gemini'
import { reportAiSchema, type ReportMetric } from '@/lib/ai/schemas/report.schema'
import { REPORT_SYSTEM, buildReportPrompt } from '@/lib/ai/prompts/reporting'
import { PROMPT_VERSIONS } from '@/lib/ai/prompts/versions'
import { CATEGORIES, CATEGORY_LABELS, SEVERITY_LABELS, type CategoryScores, type Issue } from '@/lib/audit/types'
import { generateToken, hashToken, isPlausibleToken } from '@/lib/security/tokens'
import { formatDate } from '@/lib/utils'
import { logActivity } from './activity'

const PROJECT_STATUS: Record<string, string> = { planning: 'Planning', in_progress: 'In progress', review: 'In review', completed: 'Completed', on_hold: 'On hold' }

export function periodLabel(start: string | null, end: string | null) {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`
  if (start) return `From ${formatDate(start)}`
  if (end) return `Until ${formatDate(end)}`
  return 'Current period'
}

/** Deterministic text built from stored audit data (no AI). */
export function auditSectionText(audit: { url: string; overall_score: number | null; category_scores: unknown; issues: unknown; created_at: Date }): string {
  const cats = audit.category_scores as CategoryScores | null
  const issues = (audit.issues as Issue[] | null) ?? []
  const top = issues.filter((i) => i.severity === 'critical' || i.severity === 'high').slice(0, 6)
  const lines = [
    `Website audit of ${audit.url.replace(/^https?:\/\//, '')} completed on ${formatDate(audit.created_at)}. Overall score: ${audit.overall_score ?? '—'}/100.`,
    '',
    ...(cats ? CATEGORIES.map((c) => `- ${CATEGORY_LABELS[c]}: ${cats[c]}/100`) : []),
  ]
  if (top.length) lines.push('', '## Priority issues', ...top.map((i) => `- ${i.title} (${SEVERITY_LABELS[i.severity]})`))
  else lines.push('', 'No critical or high-severity issues were found.')
  return lines.join('\n')
}

export function projectsSectionText(projects: { name: string; status: string; tasksDone: number; tasksTotal: number; deadline: string | null }[]): string {
  if (!projects.length) return 'No active projects for this client in this period.'
  return projects
    .map((p) => `- ${p.name}: ${PROJECT_STATUS[p.status] ?? p.status}${p.tasksTotal ? ` — ${p.tasksDone} of ${p.tasksTotal} tasks complete (${Math.round((p.tasksDone / p.tasksTotal) * 100)}%)` : ''}${p.deadline ? `, due ${formatDate(p.deadline)}` : ''}`)
    .join('\n')
}

async function clientProjects(tx: Tx, orgId: string, clientId: string | null) {
  if (!clientId) return []
  const rows = await tx
    .selectFrom('projects as p')
    .select(['p.name', 'p.status', 'p.deadline'])
    .select((eb) => [
      eb.selectFrom('project_tasks as t').select(sql<number>`count(*)`.as('n')).whereRef('t.project_id', '=', 'p.id').as('total'),
      eb.selectFrom('project_tasks as t').select(sql<number>`count(*)`.as('n')).whereRef('t.project_id', '=', 'p.id').where('t.status', '=', 'done').as('done'),
    ])
    .where('p.organization_id', '=', orgId)
    .where('p.client_id', '=', clientId)
    .orderBy('p.updated_at', 'desc')
    .limit(20)
    .execute()
  return rows.map((r) => ({ name: r.name, status: r.status, deadline: r.deadline, tasksTotal: Number(r.total ?? 0), tasksDone: Number(r.done ?? 0) }))
}

async function loadAudit(tx: Tx, orgId: string, auditId: string | null) {
  if (!auditId) return null
  return tx.selectFrom('website_audits').select(['id', 'url', 'overall_score', 'category_scores', 'issues', 'created_at', 'client_id']).where('id', '=', auditId).where('organization_id', '=', orgId).where('status', '=', 'completed').executeTakeFirst()
}

export async function createReport(ctx: TenantContext, input: { clientId: string | null; title: string; template: 'executive' | 'detailed'; periodStart: string | null; periodEnd: string | null; auditId: string | null }) {
  assertCan(ctx.role, 'reports:create')
  assertModule(await getEntitlements(ctx.orgId), 'reports')
  return withUser(ctx.userId, async (tx) => {
    if (input.clientId) {
      const c = await tx.selectFrom('clients').select('id').where('id', '=', input.clientId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
      if (!c) throw new AppError('validation', 'The selected client does not exist in this organization.')
    }
    const audit = await loadAudit(tx, ctx.orgId, input.auditId)
    if (input.auditId && !audit) throw new AppError('validation', 'The selected audit is not a completed audit in this organization.')
    const projects = await clientProjects(tx, ctx.orgId, input.clientId)
    const report = await tx
      .insertInto('reports')
      .values({ organization_id: ctx.orgId, client_id: input.clientId, audit_id: audit?.id ?? null, title: input.title, template: input.template, period_start: input.periodStart, period_end: input.periodEnd, created_by: ctx.userId })
      .returning('id')
      .executeTakeFirstOrThrow()
    const sections: { kind: ReportSectionKind; title: string; content: string }[] = [
      { kind: 'summary', title: 'Executive Summary', content: '' },
      ...(audit ? [{ kind: 'audit' as const, title: 'Website Health', content: auditSectionText(audit) }] : []),
      { kind: 'projects', title: 'Project Progress', content: projectsSectionText(projects) },
      { kind: 'metrics', title: 'Key Metrics', content: '' },
      { kind: 'updates', title: 'Work Completed This Period', content: '' },
      { kind: 'next_steps', title: 'Next Steps', content: '' },
    ]
    await tx.insertInto('report_sections').values(sections.map((s, i) => ({ organization_id: ctx.orgId, report_id: report.id, kind: s.kind, title: s.title, content: s.content, position: i }))).execute()
    await logActivity(tx, ctx, { action: 'report.created', entityType: 'report', entityId: report.id, summary: `Created report "${input.title}"` })
    return report.id
  })
}

export async function getReport(ctx: TenantContext, id: string) {
  return withUser(ctx.userId, async (tx) => {
    const report = await tx
      .selectFrom('reports as r')
      .leftJoin('clients as c', 'c.id', 'r.client_id')
      .selectAll('r')
      .select(['c.name as clientName', 'c.company as clientCompany'])
      .where('r.id', '=', id)
      .where('r.organization_id', '=', ctx.orgId)
      .executeTakeFirst()
    if (!report) throw new AppError('not_found', 'Report not found.')
    const [sections, shares, audit] = await Promise.all([
      tx.selectFrom('report_sections').selectAll().where('report_id', '=', id).where('organization_id', '=', ctx.orgId).orderBy('position').execute(),
      tx.selectFrom('shared_reports').select(['id', 'expires_at', 'revoked_at', 'view_count', 'last_viewed_at', 'created_at']).where('report_id', '=', id).where('organization_id', '=', ctx.orgId).orderBy('created_at', 'desc').execute(),
      loadAudit(tx, ctx.orgId, report.audit_id),
    ])
    return { report: { ...report, metrics: (report.metrics as ReportMetric[]) ?? [] }, sections, shares, audit }
  })
}

async function assertEditable(ctx: TenantContext, id: string) {
  const row = await withUser(ctx.userId, (tx) => tx.selectFrom('reports').select(['created_by', 'title']).where('id', '=', id).where('organization_id', '=', ctx.orgId).executeTakeFirst())
  if (!row) throw new AppError('not_found', 'Report not found.')
  if (!canEditOwned(ctx.role, ctx.userId, row.created_by, 'reports:edit_any')) throw new AppError('forbidden', 'Only the author or an admin can edit this report.')
  return row
}

/** AI summary grounded in audit results, project progress and verified metrics. */
export async function generateReportSummary(ctx: TenantContext, id: string) {
  await assertEditable(ctx, id)
  const { report, sections, audit } = await getReport(ctx, id)
  const projects = await withUser(ctx.userId, (tx) => clientProjects(tx, ctx.orgId, report.client_id))
  const updates = sections.find((s) => s.kind === 'updates')?.content ?? ''
  const { data } = await generateStructured(ctx, {
    feature: 'report',
    promptVersion: PROMPT_VERSIONS.report,
    schema: reportAiSchema,
    system: REPORT_SYSTEM,
    prompt: buildReportPrompt({
      clientName: report.clientName ?? 'the client',
      periodLabel: periodLabel(report.period_start, report.period_end),
      audit: audit ? { url: audit.url, score: audit.overall_score, categories: audit.category_scores, topIssues: ((audit.issues as Issue[]) ?? []).slice(0, 8).map((i) => ({ title: i.title, severity: i.severity })) } : null,
      projects,
      metrics: report.metrics.map((m) => ({ label: m.label, value: m.value, previous: m.previous, unit: m.unit, source: m.source, note: m.note })),
      updates: updates.slice(0, 4000),
    }),
    temperature: 0.4,
  })
  const summary = [data.executive_summary, data.highlights.length ? `\n## Highlights\n${data.highlights.map((h) => `- ${h}`).join('\n')}` : '', data.concerns.length ? `\n## Areas of attention\n${data.concerns.map((c) => `- ${c}`).join('\n')}` : ''].join('\n').trim()
  await withUser(ctx.userId, async (tx) => {
    await tx.updateTable('report_sections').set({ content: summary, ai_generated: true }).where('report_id', '=', id).where('organization_id', '=', ctx.orgId).where('kind', '=', 'summary').execute()
    if (data.next_steps.length) {
      await tx.updateTable('report_sections').set({ content: data.next_steps.map((n) => `- ${n}`).join('\n'), ai_generated: true }).where('report_id', '=', id).where('organization_id', '=', ctx.orgId).where('kind', '=', 'next_steps').execute()
    }
    await tx.updateTable('reports').set({ prompt_version: PROMPT_VERSIONS.report }).where('id', '=', id).where('organization_id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: 'report.summary_generated', entityType: 'report', entityId: id, summary: `Generated AI summary for "${report.title}"` })
  })
}

export async function refreshReportData(ctx: TenantContext, id: string) {
  await assertEditable(ctx, id)
  await withUser(ctx.userId, async (tx) => {
    const report = await tx.selectFrom('reports').select(['client_id', 'audit_id']).where('id', '=', id).where('organization_id', '=', ctx.orgId).executeTakeFirstOrThrow()
    const [audit, projects] = await Promise.all([loadAudit(tx, ctx.orgId, report.audit_id), clientProjects(tx, ctx.orgId, report.client_id)])
    await tx.updateTable('report_sections').set({ content: projectsSectionText(projects) }).where('report_id', '=', id).where('organization_id', '=', ctx.orgId).where('kind', '=', 'projects').execute()
    if (audit) {
      const existing = await tx.selectFrom('report_sections').select('id').where('report_id', '=', id).where('kind', '=', 'audit').executeTakeFirst()
      if (existing) await tx.updateTable('report_sections').set({ content: auditSectionText(audit) }).where('id', '=', existing.id).execute()
      else await tx.insertInto('report_sections').values({ organization_id: ctx.orgId, report_id: id, kind: 'audit', title: 'Website Health', content: auditSectionText(audit), position: 1 }).execute()
    }
  })
}

export async function updateReportMeta(ctx: TenantContext, id: string, input: { title: string; template: 'executive' | 'detailed'; status: 'draft' | 'final'; periodStart: string | null; periodEnd: string | null; auditId: string | null }) {
  await assertEditable(ctx, id)
  await withUser(ctx.userId, async (tx) => {
    if (input.auditId && !(await loadAudit(tx, ctx.orgId, input.auditId))) throw new AppError('validation', 'The selected audit is not a completed audit in this organization.')
    await tx.updateTable('reports').set({ title: input.title, template: input.template, status: input.status, period_start: input.periodStart, period_end: input.periodEnd, audit_id: input.auditId }).where('id', '=', id).where('organization_id', '=', ctx.orgId).execute()
  })
  if (input.auditId) await refreshReportData(ctx, id)
}

export async function updateReportSection(ctx: TenantContext, reportId: string, sectionId: string, input: { title: string; content: string; enabled: boolean }) {
  await assertEditable(ctx, reportId)
  await withUser(ctx.userId, async (tx) => {
    const res = await tx.updateTable('report_sections').set({ title: input.title, content: input.content, enabled: input.enabled, ai_generated: false }).where('id', '=', sectionId).where('report_id', '=', reportId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!res.numUpdatedRows) throw new AppError('not_found', 'Section not found.')
    await tx.updateTable('reports').set({ updated_at: new Date() }).where('id', '=', reportId).execute()
  })
}

export async function moveReportSection(ctx: TenantContext, reportId: string, sectionId: string, direction: 'up' | 'down') {
  await assertEditable(ctx, reportId)
  await withUser(ctx.userId, async (tx) => {
    const sections = await tx.selectFrom('report_sections').select(['id', 'position']).where('report_id', '=', reportId).where('organization_id', '=', ctx.orgId).orderBy('position').orderBy('created_at').execute()
    const idx = sections.findIndex((s) => s.id === sectionId)
    const swap = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swap < 0 || swap >= sections.length) return
    const order = sections.map((s) => s.id)
    ;[order[idx], order[swap]] = [order[swap], order[idx]]
    for (let i = 0; i < order.length; i++) await tx.updateTable('report_sections').set({ position: i }).where('id', '=', order[i]).execute()
  })
}

export async function addCustomSection(ctx: TenantContext, reportId: string, title: string) {
  await assertEditable(ctx, reportId)
  await withUser(ctx.userId, async (tx) => {
    const pos = await tx.selectFrom('report_sections').select(sql<number>`coalesce(max(position), 0) + 1`.as('p')).where('report_id', '=', reportId).executeTakeFirstOrThrow()
    await tx.insertInto('report_sections').values({ organization_id: ctx.orgId, report_id: reportId, kind: 'custom', title, content: '', position: Number(pos.p) }).execute()
  })
}

export async function deleteCustomSection(ctx: TenantContext, reportId: string, sectionId: string) {
  await assertEditable(ctx, reportId)
  await withUser(ctx.userId, async (tx) => {
    const res = await tx.deleteFrom('report_sections').where('id', '=', sectionId).where('report_id', '=', reportId).where('organization_id', '=', ctx.orgId).where('kind', '=', 'custom').executeTakeFirst()
    if (!res.numDeletedRows) throw new AppError('validation', 'Only custom sections can be deleted. Hide built-in sections instead.')
  })
}

export async function updateMetrics(ctx: TenantContext, reportId: string, metrics: ReportMetric[]) {
  await assertEditable(ctx, reportId)
  await withUser(ctx.userId, async (tx) => {
    await tx.updateTable('reports').set({ metrics: json(metrics) }).where('id', '=', reportId).where('organization_id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: 'report.metrics_updated', entityType: 'report', entityId: reportId, summary: `Updated ${metrics.length} verified metric${metrics.length === 1 ? '' : 's'}` })
  })
}

export async function deleteReport(ctx: TenantContext, id: string) {
  const row = await assertEditable(ctx, id)
  await withUser(ctx.userId, async (tx) => {
    await tx.deleteFrom('reports').where('id', '=', id).where('organization_id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: 'report.deleted', entityType: 'report', summary: `Deleted report "${row.title}"` })
  })
}

export async function listReports(ctx: TenantContext) {
  return withUser(ctx.userId, (tx) =>
    tx
      .selectFrom('reports as r')
      .leftJoin('clients as c', 'c.id', 'r.client_id')
      .select(['r.id', 'r.title', 'r.status', 'r.template', 'r.period_start', 'r.period_end', 'r.updated_at', 'c.name as clientName'])
      .select((eb) => [eb.selectFrom('shared_reports as s').select(sql<number>`count(*)`.as('n')).whereRef('s.report_id', '=', 'r.id').where('s.revoked_at', 'is', null).as('activeShares')])
      .where('r.organization_id', '=', ctx.orgId)
      .orderBy('r.updated_at', 'desc')
      .limit(200)
      .execute(),
  )
}

// ---------------------------------------------------------------------------
// Secure share links
// ---------------------------------------------------------------------------

/** Returns the raw token once. Only its hash is stored, so links cannot be recovered from the database. */
export async function createShareLink(ctx: TenantContext, reportId: string, expiresInDays: 0 | 7 | 30 | 90) {
  assertCan(ctx.role, 'reports:share')
  const token = generateToken(32)
  await withUser(ctx.userId, async (tx) => {
    const r = await tx.selectFrom('reports').select(['id', 'title']).where('id', '=', reportId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!r) throw new AppError('not_found', 'Report not found.')
    const active = await tx.selectFrom('shared_reports').select(sql<number>`count(*)`.as('n')).where('report_id', '=', reportId).where('revoked_at', 'is', null).executeTakeFirstOrThrow()
    if (Number(active.n) >= 10) throw new AppError('limit_reached', 'A report can have at most 10 active share links. Revoke an old link first.')
    await tx
      .insertInto('shared_reports')
      .values({ organization_id: ctx.orgId, report_id: reportId, token_hash: hashToken(token), expires_at: expiresInDays ? new Date(Date.now() + expiresInDays * 86400_000) : null, created_by: ctx.userId })
      .execute()
    await logActivity(tx, ctx, { action: 'report.shared', entityType: 'report', entityId: reportId, summary: `Created a share link for "${r.title}"${expiresInDays ? ` (expires in ${expiresInDays} days)` : ''}` })
  })
  return { token }
}

export async function revokeShareLink(ctx: TenantContext, reportId: string, shareId: string) {
  assertCan(ctx.role, 'reports:share')
  await withUser(ctx.userId, async (tx) => {
    const res = await tx.updateTable('shared_reports').set({ revoked_at: new Date() }).where('id', '=', shareId).where('report_id', '=', reportId).where('organization_id', '=', ctx.orgId).where('revoked_at', 'is', null).executeTakeFirst()
    if (!res.numUpdatedRows) throw new AppError('not_found', 'Share link not found or already revoked.')
    await logActivity(tx, ctx, { action: 'report.share_revoked', entityType: 'report', entityId: reportId, summary: 'Revoked a report share link' })
  })
}

/** Client-facing sections: enabled and non-empty (metrics count as content). */
export function clientVisibleSections<T extends { kind: string; content: string }>(sections: T[], metricsCount: number): T[] {
  return sections.filter((s) => s.content.trim().length > 0 || (s.kind === 'metrics' && metricsCount > 0))
}

export type SharedReportView = {
  organizationId: string
  title: string
  template: string
  clientName: string | null
  periodLabel: string
  updatedAt: Date
  sections: { kind: string; title: string; content: string }[]
  metrics: ReportMetric[]
}

/**
 * Public lookup by token. The token is hashed and matched exactly; revoked or
 * expired links return null. Only client-facing fields are returned — never
 * internal notes, author identities or other organization records.
 */
export async function getSharedReport(token: string, opts: { countView?: boolean } = {}): Promise<SharedReportView | null> {
  if (!isPlausibleToken(token)) return null
  return withSystem(async (tx) => {
    const share = await tx.selectFrom('shared_reports').select(['id', 'report_id', 'organization_id', 'expires_at', 'revoked_at']).where('token_hash', '=', hashToken(token)).executeTakeFirst()
    if (!share || share.revoked_at || (share.expires_at && share.expires_at.getTime() <= Date.now())) return null
    const report = await tx
      .selectFrom('reports as r')
      .leftJoin('clients as c', (j) => j.onRef('c.id', '=', 'r.client_id').onRef('c.organization_id', '=', 'r.organization_id'))
      .select(['r.title', 'r.template', 'r.period_start', 'r.period_end', 'r.metrics', 'r.updated_at', 'c.name as clientName'])
      .where('r.id', '=', share.report_id)
      .where('r.organization_id', '=', share.organization_id)
      .executeTakeFirst()
    if (!report) return null
    const sections = await tx.selectFrom('report_sections').select(['kind', 'title', 'content']).where('report_id', '=', share.report_id).where('organization_id', '=', share.organization_id).where('enabled', '=', true).orderBy('position').execute()
    if (opts.countView) await tx.updateTable('shared_reports').set({ view_count: sql`view_count + 1`, last_viewed_at: new Date() }).where('id', '=', share.id).execute()
    return {
      organizationId: share.organization_id,
      title: report.title,
      template: report.template,
      clientName: report.clientName,
      periodLabel: periodLabel(report.period_start, report.period_end),
      updatedAt: report.updated_at,
      sections: clientVisibleSections(sections, ((report.metrics as ReportMetric[]) ?? []).length),
      metrics: (report.metrics as ReportMetric[]) ?? [],
    }
  })
}
