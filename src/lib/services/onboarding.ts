import 'server-only'
import { randomUUID } from 'node:crypto'
import { json, withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { assertCan, canEditOwned } from '@/lib/auth/permissions'
import type { TenantContext } from '@/lib/auth/session'
import type { OnboardingDocStatus } from '@/lib/db/types'
import { assertModule, getEntitlements } from '@/lib/licensing/entitlements'
import { generateStructured, isAiConfigured } from '@/lib/ai/gemini'
import { ONBOARDING_DOC_TYPES, onboardingAiSchema, type ChecklistItem, type OnboardingDocType } from '@/lib/ai/schemas/onboarding.schema'
import { ONBOARDING_SYSTEM, buildOnboardingPrompt } from '@/lib/ai/prompts/onboarding'
import { PROMPT_VERSIONS } from '@/lib/ai/prompts/versions'
import { isEmailConfigured, layoutEmail, sendEmail, textToHtml } from '@/lib/email/send'
import { logActivity } from './activity'

export const PROJECT_TYPES = ['SEO campaign', 'Website design', 'Web development', 'Paid advertising (PPC)', 'Social media marketing', 'Content marketing', 'Branding', 'E-commerce', 'Email marketing', 'Other'] as const

/** Progress = completed documents + ticked checklist items, over the total. */
export function computeProgress(docs: { status: string; items: unknown }[]): { done: number; total: number; percent: number } {
  let done = 0
  let total = 0
  for (const d of docs) {
    const items = (d.items as ChecklistItem[]) ?? []
    if (items.length) {
      total += items.length
      done += items.filter((i) => i.done).length
    } else {
      total += 1
      if (d.status === 'completed' || d.status === 'sent') done += 1
    }
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}

export async function createOnboardingKit(ctx: TenantContext, input: { clientId: string; projectId: string | null; projectType: string; requirements: string; types: OnboardingDocType[] }) {
  assertCan(ctx.role, 'onboarding:create')
  assertModule(await getEntitlements(ctx.orgId), 'onboarding')
  const { client, agencyName } = await withUser(ctx.userId, async (tx) => {
    const client = await tx.selectFrom('clients').select(['id', 'name', 'company']).where('id', '=', input.clientId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!client) throw new AppError('validation', 'The selected client does not exist in this organization.')
    if (input.projectId) {
      const p = await tx.selectFrom('projects').select('id').where('id', '=', input.projectId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
      if (!p) throw new AppError('validation', 'The selected project does not exist in this organization.')
    }
    const b = await tx.selectFrom('branding_settings').select('company_name').where('organization_id', '=', ctx.orgId).executeTakeFirst()
    const o = await tx.selectFrom('organizations').select('name').where('id', '=', ctx.orgId).executeTakeFirstOrThrow()
    return { client, agencyName: b?.company_name || o.name }
  })

  const types = ONBOARDING_DOC_TYPES.filter((d) => input.types.includes(d.type))
  let docs: { type: OnboardingDocType; title: string; subject: string | null; content: string; items: ChecklistItem[] }[]
  let aiGenerated = false
  if (isAiConfigured()) {
    const { data } = await generateStructured(ctx, {
      feature: 'onboarding',
      promptVersion: PROMPT_VERSIONS.onboarding,
      schema: onboardingAiSchema,
      system: ONBOARDING_SYSTEM,
      prompt: buildOnboardingPrompt({ agencyName, clientName: client.name, clientCompany: client.company, projectType: input.projectType, requirements: input.requirements, types: input.types }),
      temperature: 0.5,
      maxOutputTokens: 12000,
    })
    const byType = new Map(data.documents.map((d) => [d.type, d]))
    docs = types.map((t) => {
      const d = byType.get(t.type)
      return {
        type: t.type,
        title: d?.title || t.title,
        subject: t.type === 'welcome_email' ? (d?.subject ?? `Welcome to ${agencyName}`) : null,
        content: d?.content ?? '',
        items: t.checklist ? (d?.items ?? []).map((label) => ({ id: randomUUID(), label, done: false })) : [],
      }
    })
    aiGenerated = true
  } else {
    docs = types.map((t) => ({ type: t.type, title: t.title, subject: t.type === 'welcome_email' ? `Welcome to ${agencyName}` : null, content: '', items: [] }))
  }

  return withUser(ctx.userId, async (tx) => {
    const kit = await tx
      .insertInto('onboarding_kits')
      .values({ organization_id: ctx.orgId, client_id: client.id, project_id: input.projectId, title: `${client.name} — ${input.projectType} onboarding`.slice(0, 200), project_type: input.projectType, requirements: input.requirements, prompt_version: aiGenerated ? PROMPT_VERSIONS.onboarding : null, created_by: ctx.userId })
      .returning('id')
      .executeTakeFirstOrThrow()
    await tx
      .insertInto('onboarding_documents')
      .values(docs.map((d, i) => ({ organization_id: ctx.orgId, kit_id: kit.id, doc_type: d.type, title: d.title, subject: d.subject, content: d.content, items: json(d.items), position: i, created_by: ctx.userId })))
      .execute()
    await logActivity(tx, ctx, { action: 'onboarding.created', entityType: 'onboarding', entityId: kit.id, summary: aiGenerated ? `Generated ${docs.length} onboarding document${docs.length === 1 ? '' : 's'} with AI for ${client.name}` : `Created ${docs.length} onboarding template${docs.length === 1 ? '' : 's'} for ${client.name}` })
    return kit.id
  })
}

export async function getOnboardingKit(ctx: TenantContext, id: string) {
  return withUser(ctx.userId, async (tx) => {
    const kit = await tx
      .selectFrom('onboarding_kits as k')
      .leftJoin('clients as c', 'c.id', 'k.client_id')
      .leftJoin('projects as p', 'p.id', 'k.project_id')
      .selectAll('k')
      .select(['c.name as clientName', 'c.email as clientEmail', 'p.name as projectName'])
      .where('k.id', '=', id)
      .where('k.organization_id', '=', ctx.orgId)
      .executeTakeFirst()
    if (!kit) throw new AppError('not_found', 'Onboarding kit not found.')
    const docs = await tx.selectFrom('onboarding_documents').selectAll().where('kit_id', '=', id).where('organization_id', '=', ctx.orgId).orderBy('position').execute()
    return { kit, docs: docs.map((d) => ({ ...d, items: (d.items as ChecklistItem[]) ?? [] })) }
  })
}

export async function listOnboardingKits(ctx: TenantContext) {
  return withUser(ctx.userId, async (tx) => {
    const kits = await tx
      .selectFrom('onboarding_kits as k')
      .leftJoin('clients as c', 'c.id', 'k.client_id')
      .select(['k.id', 'k.title', 'k.project_type', 'k.created_at', 'k.updated_at', 'c.name as clientName'])
      .where('k.organization_id', '=', ctx.orgId)
      .orderBy('k.created_at', 'desc')
      .limit(200)
      .execute()
    if (!kits.length) return []
    const docs = await tx.selectFrom('onboarding_documents').select(['kit_id', 'status', 'items']).where('organization_id', '=', ctx.orgId).where('kit_id', 'in', kits.map((k) => k.id)).execute()
    return kits.map((k) => {
      const kd = docs.filter((d) => d.kit_id === k.id)
      return { ...k, documentCount: kd.length, progress: computeProgress(kd) }
    })
  })
}

async function assertEditable(ctx: TenantContext, kitId: string) {
  const row = await withUser(ctx.userId, (tx) => tx.selectFrom('onboarding_kits').select(['created_by', 'title']).where('id', '=', kitId).where('organization_id', '=', ctx.orgId).executeTakeFirst())
  if (!row) throw new AppError('not_found', 'Onboarding kit not found.')
  if (!canEditOwned(ctx.role, ctx.userId, row.created_by, 'onboarding:edit_any')) throw new AppError('forbidden', 'Only the author or an admin can edit these documents.')
  return row
}

export async function updateOnboardingDoc(ctx: TenantContext, kitId: string, docId: string, input: { title: string; subject: string | null; content: string; status: OnboardingDocStatus }) {
  await assertEditable(ctx, kitId)
  await withUser(ctx.userId, async (tx) => {
    const res = await tx.updateTable('onboarding_documents').set({ title: input.title, subject: input.subject, content: input.content, status: input.status }).where('id', '=', docId).where('kit_id', '=', kitId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!res.numUpdatedRows) throw new AppError('not_found', 'Document not found.')
    await tx.updateTable('onboarding_kits').set({ updated_at: new Date() }).where('id', '=', kitId).execute()
  })
}

export async function setChecklistItems(ctx: TenantContext, kitId: string, docId: string, items: ChecklistItem[]) {
  await assertEditable(ctx, kitId)
  await withUser(ctx.userId, async (tx) => {
    const doc = await tx.selectFrom('onboarding_documents').select(['doc_type', 'title']).where('id', '=', docId).where('kit_id', '=', kitId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!doc) throw new AppError('not_found', 'Document not found.')
    if (doc.doc_type !== 'checklist' && doc.doc_type !== 'asset_list') throw new AppError('validation', 'Only checklists and asset lists have items.')
    const allDone = items.length > 0 && items.every((i) => i.done)
    await tx.updateTable('onboarding_documents').set({ items: json(items), status: allDone ? 'completed' : 'ready' }).where('id', '=', docId).execute()
    if (allDone) await logActivity(tx, ctx, { action: 'onboarding.checklist_completed', entityType: 'onboarding', entityId: kitId, summary: `Completed "${doc.title}"` })
  })
}

/**
 * Sends the welcome email only on explicit request, only with a configured
 * provider, only by an admin/owner, and only to the client's stored address.
 */
export async function sendWelcomeEmail(ctx: TenantContext, kitId: string, docId: string) {
  assertCan(ctx.role, 'onboarding:send_email')
  if (!isEmailConfigured()) throw new AppError('not_configured', 'Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.')
  const { kit, docs } = await getOnboardingKit(ctx, kitId)
  const doc = docs.find((d) => d.id === docId)
  if (!doc || doc.doc_type !== 'welcome_email') throw new AppError('validation', 'Only the welcome email can be sent.')
  if (!kit.clientEmail) throw new AppError('validation', 'The client has no email address. Add one to the client record first.')
  if (!doc.content.trim() || !doc.subject?.trim()) throw new AppError('validation', 'Add a subject and body before sending.')
  const replyTo = await withUser(ctx.userId, (tx) => tx.selectFrom('branding_settings').select('contact_email').where('organization_id', '=', ctx.orgId).executeTakeFirst())
  await sendEmail({ to: kit.clientEmail, subject: doc.subject, text: doc.content, html: layoutEmail(doc.subject, textToHtml(doc.content)), replyTo: replyTo?.contact_email ?? undefined })
  await withUser(ctx.userId, async (tx) => {
    await tx.updateTable('onboarding_documents').set({ status: 'sent', sent_at: new Date() }).where('id', '=', docId).where('organization_id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: 'onboarding.email_sent', entityType: 'onboarding', entityId: kitId, summary: `Sent the welcome email to ${kit.clientName ?? 'the client'}` })
  })
  return { to: kit.clientEmail }
}

export async function deleteOnboardingKit(ctx: TenantContext, kitId: string) {
  const row = await assertEditable(ctx, kitId)
  await withUser(ctx.userId, async (tx) => {
    await tx.deleteFrom('onboarding_kits').where('id', '=', kitId).where('organization_id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: 'onboarding.deleted', entityType: 'onboarding', summary: `Deleted "${row.title}"` })
  })
}
