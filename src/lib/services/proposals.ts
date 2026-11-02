import 'server-only'
import { sql } from 'kysely'
import { json, withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { assertCan, canEditOwned } from '@/lib/auth/permissions'
import type { TenantContext } from '@/lib/auth/session'
import type { ProposalStatus, ProposalTemplate } from '@/lib/db/types'
import { assertModule, getEntitlements } from '@/lib/licensing/entitlements'
import { generateStructured } from '@/lib/ai/gemini'
import { PROPOSAL_SECTIONS, allocateBudget, proposalAiSchema, proposalSectionAiSchema, type PricingItem, type ProposalSectionKey } from '@/lib/ai/schemas/proposal.schema'
import { PROPOSAL_SYSTEM, buildProposalPrompt, buildSectionPrompt, type ProposalBrief } from '@/lib/ai/prompts/proposal'
import { PROMPT_VERSIONS } from '@/lib/ai/prompts/versions'
import type { ProposalBriefInput } from '@/lib/validators/documents'
import { logActivity } from './activity'

export function totalOf(items: PricingItem[]): number | null {
  if (!items.length || items.some((i) => i.amount === null)) return null
  return Math.round(items.reduce((s, i) => s + (i.amount ?? 0), 0) * 100) / 100
}

async function orgName(ctx: TenantContext) {
  return withUser(ctx.userId, async (tx) => {
    const b = await tx.selectFrom('branding_settings').select('company_name').where('organization_id', '=', ctx.orgId).executeTakeFirst()
    const o = await tx.selectFrom('organizations').select('name').where('id', '=', ctx.orgId).executeTakeFirstOrThrow()
    return b?.company_name || o.name
  })
}

export function briefFromInput(input: ProposalBriefInput, agencyName: string): ProposalBrief {
  return {
    clientName: input.clientName,
    clientCompany: input.clientCompany,
    projectTitle: input.projectTitle,
    projectDescription: input.projectDescription,
    requirements: input.requirements ?? '',
    services: input.services ?? '',
    deliverables: input.deliverables ?? '',
    budget: input.budget,
    currency: input.currency,
    timeline: input.timeline ?? '',
    paymentTerms: input.paymentTerms ?? '',
    notes: input.notes ?? '',
    agencyName,
  }
}

/** Creates a proposal. With mode=ai the full draft is generated first, then saved atomically. */
export async function createProposal(ctx: TenantContext, input: ProposalBriefInput): Promise<string> {
  assertCan(ctx.role, 'proposals:create')
  assertModule(await getEntitlements(ctx.orgId), 'proposals')
  if (input.clientId) {
    const ok = await withUser(ctx.userId, (tx) => tx.selectFrom('clients').select('id').where('id', '=', input.clientId!).where('organization_id', '=', ctx.orgId).executeTakeFirst())
    if (!ok) throw new AppError('validation', 'The selected client does not exist in this organization.')
  }
  const brief = briefFromInput(input, await orgName(ctx))

  let sections: Record<ProposalSectionKey, string>
  let pricing: PricingItem[] = input.budget ? [{ item: 'Project fee', description: '', amount: input.budget }] : []
  let aiGenerated = false
  if (input.mode === 'ai') {
    const { data } = await generateStructured(ctx, { feature: 'proposal', promptVersion: PROMPT_VERSIONS.proposal, schema: proposalAiSchema, system: PROPOSAL_SYSTEM, prompt: buildProposalPrompt(brief), temperature: 0.5 })
    pricing = allocateBudget(data.pricing_items, input.budget)
    sections = {
      executive_summary: data.executive_summary,
      client_challenges: data.client_challenges,
      proposed_solution: data.proposed_solution,
      scope_of_work: data.scope_of_work,
      deliverables: data.deliverables,
      timeline: data.timeline,
      pricing: data.pricing_intro,
      payment_terms: data.payment_terms,
      terms_conditions: data.terms_conditions,
      next_steps: data.next_steps,
    }
    aiGenerated = true
  } else {
    sections = Object.fromEntries(PROPOSAL_SECTIONS.map((s) => [s.key, ''])) as Record<ProposalSectionKey, string>
    sections.deliverables = input.deliverables ?? ''
    sections.payment_terms = input.paymentTerms ?? ''
  }

  return withUser(ctx.userId, async (tx) => {
    const p = await tx
      .insertInto('proposals')
      .values({
        organization_id: ctx.orgId,
        client_id: input.clientId,
        title: input.projectTitle,
        template: input.template,
        brief: json(brief),
        pricing_items: json(pricing),
        currency: input.currency,
        total_amount: totalOf(pricing),
        prompt_version: aiGenerated ? PROMPT_VERSIONS.proposal : null,
        created_by: ctx.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    await tx
      .insertInto('proposal_sections')
      .values(PROPOSAL_SECTIONS.map((s, i) => ({ organization_id: ctx.orgId, proposal_id: p.id, key: s.key, title: s.title, content: sections[s.key] ?? '', position: i, ai_generated: aiGenerated })))
      .execute()
    await logActivity(tx, ctx, { action: 'proposal.created', entityType: 'proposal', entityId: p.id, summary: `Created proposal "${input.projectTitle}"${aiGenerated ? ' with AI' : ''}` })
    return p.id
  })
}

export async function getProposal(ctx: TenantContext, id: string) {
  return withUser(ctx.userId, async (tx) => {
    const proposal = await tx
      .selectFrom('proposals as p')
      .leftJoin('clients as c', 'c.id', 'p.client_id')
      .leftJoin('user as u', 'u.id', 'p.created_by')
      .selectAll('p')
      .select(['c.name as clientName', 'c.company as clientCompany', 'u.name as createdByName'])
      .where('p.id', '=', id)
      .where('p.organization_id', '=', ctx.orgId)
      .executeTakeFirst()
    if (!proposal) throw new AppError('not_found', 'Proposal not found.')
    const sections = await tx.selectFrom('proposal_sections').selectAll().where('proposal_id', '=', id).where('organization_id', '=', ctx.orgId).orderBy('position').execute()
    return { proposal: { ...proposal, brief: proposal.brief as ProposalBrief, pricing_items: proposal.pricing_items as PricingItem[] }, sections }
  })
}

async function assertEditable(ctx: TenantContext, id: string) {
  const row = await withUser(ctx.userId, (tx) => tx.selectFrom('proposals').select(['created_by', 'title']).where('id', '=', id).where('organization_id', '=', ctx.orgId).executeTakeFirst())
  if (!row) throw new AppError('not_found', 'Proposal not found.')
  if (!canEditOwned(ctx.role, ctx.userId, row.created_by, 'proposals:edit_any')) throw new AppError('forbidden', 'Only the author or an admin can edit this proposal.')
  return row
}

export async function updateSection(ctx: TenantContext, id: string, key: ProposalSectionKey, content: string) {
  await assertEditable(ctx, id)
  await withUser(ctx.userId, async (tx) => {
    const res = await tx.updateTable('proposal_sections').set({ content, ai_generated: false }).where('proposal_id', '=', id).where('key', '=', key).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!res.numUpdatedRows) throw new AppError('not_found', 'Section not found.')
    await tx.updateTable('proposals').set({ updated_at: new Date() }).where('id', '=', id).where('organization_id', '=', ctx.orgId).execute()
  })
}

export async function regenerateSection(ctx: TenantContext, id: string, key: ProposalSectionKey, instructions: string) {
  await assertEditable(ctx, id)
  const { proposal, sections } = await getProposal(ctx, id)
  const title = PROPOSAL_SECTIONS.find((s) => s.key === key)!.title
  const current = Object.fromEntries(sections.map((s) => [s.key, s.content]))
  const { data } = await generateStructured(ctx, {
    feature: 'proposal_section',
    promptVersion: PROMPT_VERSIONS.proposal_section,
    schema: proposalSectionAiSchema,
    system: PROPOSAL_SYSTEM,
    prompt: buildSectionPrompt(proposal.brief, key, title, current, instructions),
    temperature: 0.6,
  })
  await withUser(ctx.userId, async (tx) => {
    await tx.updateTable('proposal_sections').set({ content: data.content, ai_generated: true }).where('proposal_id', '=', id).where('key', '=', key).where('organization_id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: 'proposal.section_regenerated', entityType: 'proposal', entityId: id, summary: `Regenerated "${title}" in "${proposal.title}"` })
  })
  return data.content
}

export async function updateProposalMeta(ctx: TenantContext, id: string, input: { title: string; status: ProposalStatus; template: ProposalTemplate; clientId: string | null; validUntil: string | null; currency: string }) {
  const before = await assertEditable(ctx, id)
  await withUser(ctx.userId, async (tx) => {
    await tx.updateTable('proposals').set({ title: input.title, status: input.status, template: input.template, client_id: input.clientId, valid_until: input.validUntil, currency: input.currency }).where('id', '=', id).where('organization_id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: 'proposal.updated', entityType: 'proposal', entityId: id, summary: `Updated proposal "${before.title}" (${input.status})` })
  })
}

export async function updatePricing(ctx: TenantContext, id: string, items: PricingItem[]) {
  await assertEditable(ctx, id)
  await withUser(ctx.userId, (tx) =>
    tx.updateTable('proposals').set({ pricing_items: json(items), total_amount: totalOf(items) }).where('id', '=', id).where('organization_id', '=', ctx.orgId).execute(),
  )
}

/** Copies a proposal and all of its sections in one transaction. */
export async function duplicateProposal(ctx: TenantContext, id: string): Promise<string> {
  assertCan(ctx.role, 'proposals:create')
  return withUser(ctx.userId, async (tx) => {
    const src = await tx.selectFrom('proposals').selectAll().where('id', '=', id).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!src) throw new AppError('not_found', 'Proposal not found.')
    const copy = await tx
      .insertInto('proposals')
      .values({
        organization_id: ctx.orgId,
        client_id: src.client_id,
        title: `${src.title} (copy)`.slice(0, 200),
        template: src.template,
        status: 'draft',
        brief: json(src.brief),
        pricing_items: json(src.pricing_items),
        currency: src.currency,
        total_amount: src.total_amount,
        valid_until: src.valid_until,
        prompt_version: src.prompt_version,
        created_by: ctx.userId,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    await sql`
      insert into proposal_sections (organization_id, proposal_id, key, title, content, position, ai_generated)
      select organization_id, ${copy.id}::uuid, key, title, content, position, ai_generated
      from proposal_sections where proposal_id = ${id}::uuid and organization_id = ${ctx.orgId}::uuid
    `.execute(tx)
    await logActivity(tx, ctx, { action: 'proposal.duplicated', entityType: 'proposal', entityId: copy.id, summary: `Duplicated proposal "${src.title}"` })
    return copy.id
  })
}

export async function deleteProposal(ctx: TenantContext, id: string) {
  const row = await assertEditable(ctx, id)
  await withUser(ctx.userId, async (tx) => {
    await tx.deleteFrom('proposals').where('id', '=', id).where('organization_id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: 'proposal.deleted', entityType: 'proposal', summary: `Deleted proposal "${row.title}"` })
  })
}

export async function listProposals(ctx: TenantContext, status?: string) {
  return withUser(ctx.userId, (tx) => {
    let q = tx
      .selectFrom('proposals as p')
      .leftJoin('clients as c', 'c.id', 'p.client_id')
      .leftJoin('user as u', 'u.id', 'p.created_by')
      .select(['p.id', 'p.title', 'p.status', 'p.template', 'p.total_amount', 'p.currency', 'p.updated_at', 'c.name as clientName', 'u.name as authorName'])
      .where('p.organization_id', '=', ctx.orgId)
    if (status && status !== 'all') q = q.where('p.status', '=', status as ProposalStatus)
    return q.orderBy('p.updated_at', 'desc').limit(200).execute()
  })
}
