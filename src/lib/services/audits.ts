import 'server-only'
import { sql } from 'kysely'
import { json, withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { assertCan } from '@/lib/auth/permissions'
import type { TenantContext } from '@/lib/auth/session'
import { env } from '@/lib/env'
import { assertAuditQuota, assertModule, getEntitlements } from '@/lib/licensing/entitlements'
import { rateLimit } from '@/lib/security/rate-limit'
import { validatePublicUrl, UrlValidationError } from '@/lib/security/url-validation'
import { safeFetch } from '@/lib/security/safe-fetch'
import { AuditFetchError, runAuditEngine, type ProgressStep } from '@/lib/audit/run'
import { RULES_VERSION } from '@/lib/audit/checks'
import { fetchPageSpeed } from '@/lib/audit/pagespeed'
import type { CategoryScores, Findings, Issue } from '@/lib/audit/types'
import { generateStructured, isAiConfigured } from '@/lib/ai/gemini'
import { auditAiSchema, sanitizeAuditAi, type AuditAi } from '@/lib/ai/schemas/audit.schema'
import { AUDIT_SYSTEM, buildAuditPrompt } from '@/lib/ai/prompts/website-audit'
import { PROMPT_VERSIONS } from '@/lib/ai/prompts/versions'
import { logActivity } from './activity'
import { PAGE_SIZE } from './clients'

export type AuditProgress = ProgressStep | 'ai' | 'saving'

async function assertClientInOrg(ctx: TenantContext, clientId: string | null) {
  if (!clientId) return null
  const c = await withUser(ctx.userId, (tx) => tx.selectFrom('clients').select(['id', 'name']).where('id', '=', clientId).where('organization_id', '=', ctx.orgId).executeTakeFirst())
  if (!c) throw new AppError('validation', 'The selected client does not exist in this organization.')
  return c
}

async function analyze(ctx: TenantContext, auditId: string, data: { url: string; overall: number; categories: CategoryScores; issues: Issue[]; findings: Findings; clientName: string | null }) {
  if (!isAiConfigured()) {
    await withUser(ctx.userId, (tx) => tx.updateTable('website_audits').set({ ai_status: 'skipped', ai_error: 'Gemini is not configured' }).where('id', '=', auditId).where('organization_id', '=', ctx.orgId).execute())
    return
  }
  try {
    const { data: ai } = await generateStructured(ctx, {
      feature: 'audit',
      promptVersion: PROMPT_VERSIONS.audit,
      schema: auditAiSchema,
      system: AUDIT_SYSTEM,
      prompt: buildAuditPrompt(data),
      temperature: 0.3,
    })
    const clean = sanitizeAuditAi(ai, new Set(data.issues.map((i) => i.id)))
    await withUser(ctx.userId, (tx) =>
      tx.updateTable('website_audits').set({ ai_analysis: json(clean), ai_status: 'completed', ai_error: null, prompt_version: PROMPT_VERSIONS.audit }).where('id', '=', auditId).where('organization_id', '=', ctx.orgId).execute(),
    )
  } catch (err) {
    const message = err instanceof AppError ? err.message : 'AI analysis failed.'
    await withUser(ctx.userId, (tx) => tx.updateTable('website_audits').set({ ai_status: 'failed', ai_error: message.slice(0, 500) }).where('id', '=', auditId).where('organization_id', '=', ctx.orgId).execute())
  }
}

/** Runs a full audit and persists every result. Emits real progress steps. */
export async function runAudit(ctx: TenantContext, input: { url: string; clientId: string | null }, onProgress?: (s: AuditProgress) => void | Promise<void>): Promise<string> {
  assertCan(ctx.role, 'audits:create')
  let url: URL
  try {
    url = validatePublicUrl(input.url)
  } catch (err) {
    throw new AppError('validation', err instanceof UrlValidationError ? err.message : 'Invalid URL', { fieldErrors: { url: [err instanceof Error ? err.message : 'Invalid URL'] } })
  }
  const ent = await getEntitlements(ctx.orgId)
  assertModule(ent, 'audits')
  await rateLimit({ key: `audit:user:${ctx.userId}`, limit: 5, windowSeconds: 60, message: 'Please wait a minute before starting another audit.' })
  await rateLimit({ key: `audit:org:${ctx.orgId}`, limit: 40, windowSeconds: 3600, message: 'Your organization has started many audits this hour. Try again later.' })
  const client = await assertClientInOrg(ctx, input.clientId)

  const auditId = await withUser(ctx.userId, async (tx) => {
    await assertAuditQuota(tx, ctx.orgId, ent)
    const row = await tx
      .insertInto('website_audits')
      .values({ organization_id: ctx.orgId, client_id: client?.id ?? null, url: url.toString(), status: 'running', rules_version: RULES_VERSION, created_by: ctx.userId })
      .returning('id')
      .executeTakeFirstOrThrow()
    return row.id
  })

  const psiKey = env().PAGESPEED_API_KEY
  let result: Awaited<ReturnType<typeof runAuditEngine>>
  try {
    result = await runAuditEngine(url.toString(), {
      fetcher: (u, o) => safeFetch(u, o),
      pagespeed: psiKey ? (u) => fetchPageSpeed(u, psiKey) : undefined,
      onProgress,
    })
  } catch (err) {
    const message = err instanceof AuditFetchError ? err.message : 'The audit could not be completed.'
    if (!(err instanceof AuditFetchError)) console.error('[audit] engine error', (err as Error).message)
    await withUser(ctx.userId, async (tx) => {
      await tx.updateTable('website_audits').set({ status: 'failed', error: message.slice(0, 500), ai_status: 'skipped', completed_at: new Date() }).where('id', '=', auditId).where('organization_id', '=', ctx.orgId).execute()
      await logActivity(tx, ctx, { action: 'audit.failed', entityType: 'audit', entityId: auditId, summary: `Audit of ${url.hostname} failed` })
    })
    throw new AppError('upstream_failed', message)
  }

  await onProgress?.('saving')
  await withUser(ctx.userId, async (tx) => {
    await tx
      .updateTable('website_audits')
      .set({
        status: 'completed',
        final_url: result.findings.fetch.finalUrl,
        overall_score: result.overall,
        category_scores: json(result.categories),
        findings: json(result.findings),
        issues: json(result.issues),
        pagespeed: result.findings.pagespeed ? json(result.findings.pagespeed) : null,
        completed_at: new Date(),
      })
      .where('id', '=', auditId)
      .where('organization_id', '=', ctx.orgId)
      .execute()
    await logActivity(tx, ctx, { action: 'audit.completed', entityType: 'audit', entityId: auditId, summary: `Audited ${url.hostname} — score ${result.overall}` })
  })

  await onProgress?.('ai')
  await analyze(ctx, auditId, { url: result.findings.fetch.finalUrl, overall: result.overall, categories: result.categories, issues: result.issues, findings: result.findings, clientName: client?.name ?? null })
  return auditId
}

export async function regenerateAuditAnalysis(ctx: TenantContext, id: string) {
  assertCan(ctx.role, 'audits:create')
  const audit = await getAudit(ctx, id)
  if (audit.status !== 'completed' || !audit.findings || !audit.issues || !audit.category_scores) throw new AppError('validation', 'Only completed audits can be re-analysed.')
  if (!isAiConfigured()) throw new AppError('not_configured', 'AI generation is not configured. Set GEMINI_API_KEY on the server.')
  await withUser(ctx.userId, (tx) => tx.updateTable('website_audits').set({ ai_status: 'pending', ai_error: null }).where('id', '=', id).where('organization_id', '=', ctx.orgId).execute())
  await analyze(ctx, id, { url: audit.final_url ?? audit.url, overall: audit.overall_score ?? 0, categories: audit.category_scores, issues: audit.issues, findings: audit.findings, clientName: audit.clientName })
  await withUser(ctx.userId, (tx) => logActivity(tx, ctx, { action: 'audit.reanalysed', entityType: 'audit', entityId: id, summary: `Regenerated AI analysis for ${new URL(audit.url).hostname}` }))
}

export type AuditRecord = Awaited<ReturnType<typeof getAudit>>

export async function getAudit(ctx: TenantContext, id: string) {
  const row = await withUser(ctx.userId, (tx) =>
    tx
      .selectFrom('website_audits as a')
      .leftJoin('clients as c', 'c.id', 'a.client_id')
      .leftJoin('user as u', 'u.id', 'a.created_by')
      .selectAll('a')
      .select(['c.name as clientName', 'u.name as createdByName'])
      .where('a.id', '=', id)
      .where('a.organization_id', '=', ctx.orgId)
      .executeTakeFirst(),
  )
  if (!row) throw new AppError('not_found', 'Audit not found.')
  return {
    ...row,
    findings: row.findings as Findings | null,
    issues: row.issues as Issue[] | null,
    category_scores: row.category_scores as CategoryScores | null,
    ai_analysis: row.ai_analysis as AuditAi | null,
  }
}

export async function listAudits(ctx: TenantContext, page = 1, clientId?: string) {
  return withUser(ctx.userId, async (tx) => {
    let q = tx.selectFrom('website_audits as a').leftJoin('clients as c', 'c.id', 'a.client_id').where('a.organization_id', '=', ctx.orgId)
    if (clientId) q = q.where('a.client_id', '=', clientId)
    const [rows, total] = await Promise.all([
      q
        .select(['a.id', 'a.url', 'a.final_url', 'a.status', 'a.overall_score', 'a.ai_status', 'a.created_at', 'a.error', 'c.name as clientName'])
        .orderBy('a.created_at', 'desc')
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE)
        .execute(),
      q.select(sql<number>`count(*)`.as('n')).executeTakeFirstOrThrow(),
    ])
    return { rows, total: Number(total.n), page, pageSize: PAGE_SIZE }
  })
}

export async function deleteAudit(ctx: TenantContext, id: string) {
  assertCan(ctx.role, 'audits:delete')
  await withUser(ctx.userId, async (tx) => {
    const row = await tx.deleteFrom('website_audits').where('id', '=', id).where('organization_id', '=', ctx.orgId).returning('url').executeTakeFirst()
    if (!row) throw new AppError('not_found', 'Audit not found.')
    await logActivity(tx, ctx, { action: 'audit.deleted', entityType: 'audit', summary: `Deleted audit of ${row.url}` })
  })
}
