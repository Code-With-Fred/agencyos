import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { __setModelClient } from '@/lib/ai/gemini'
import { json, withSystem, withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { activateLicense, issueLicense } from '@/lib/licensing/service'
import { createClient } from '@/lib/services/clients'
import { createProject, addTask, setTaskStatus } from '@/lib/services/projects'
import { createProposal, deleteProposal, duplicateProposal, getProposal, regenerateSection, updateSection } from '@/lib/services/proposals'
import { createReport, createShareLink, generateReportSummary, getReport, getSharedReport, revokeShareLink, updateMetrics, updateReportSection } from '@/lib/services/reports'
import { computeProgress, createOnboardingKit, getOnboardingKit, sendWelcomeEmail, setChecklistItems } from '@/lib/services/onboarding'
import { getAudit, regenerateAuditAnalysis, runAudit } from '@/lib/services/audits'
import { runAuditEngine } from '@/lib/audit/run'
import { RULES_VERSION } from '@/lib/audit/checks'
import type { TenantContext } from '@/lib/auth/session'
import type { ProposalBriefInput } from '@/lib/validators/documents'
import { addMember, adminPool, closeTestDatabase, createOrgFor, createUser, resetTestDatabase } from './helpers/db'
import { fakeModel } from './helpers/fake-ai'
import { GOOD_HTML } from './fixtures/pages'

let owner: TenantContext, member: TenantContext, outsider: TenantContext, clientId: string

const PROPOSAL_JSON = JSON.stringify({
  executive_summary: 'Acme wants more qualified leads from organic search.',
  client_challenges: '- Low visibility for service keywords\n- Slow mobile pages',
  proposed_solution: 'A three-phase SEO program.',
  scope_of_work: '- Technical SEO\n- Content',
  deliverables: '- Audit report\n- 8 articles',
  timeline: '- Weeks 1–2: Discovery\n- Weeks 3–12: Execution',
  pricing_intro: 'The investment below covers the full program.',
  pricing_items: [
    { item: 'Technical SEO', description: 'Fixes', share_percent: 40 },
    { item: 'Content', description: '8 articles', share_percent: 60 },
  ],
  payment_terms: '50% upfront, 50% on completion.',
  terms_conditions: 'Template terms — review before signing.',
  next_steps: '- Approve proposal\n- Kickoff call',
})

const brief = (over: Partial<ProposalBriefInput> = {}): ProposalBriefInput => ({
  clientId,
  clientName: 'Acme Plumbing',
  clientCompany: 'Acme LLC',
  projectTitle: 'SEO Growth Program',
  projectDescription: 'Grow organic leads in Austin.',
  requirements: 'Local SEO',
  services: 'SEO',
  deliverables: 'Audit, content',
  budget: 12000,
  currency: 'USD',
  timeline: '12 weeks',
  paymentTerms: '50/50',
  notes: null,
  template: 'consulting',
  mode: 'ai',
  ...over,
})

beforeAll(async () => {
  await resetTestDatabase()
  owner = await createOrgFor((await createUser('Owen Owner')).id, 'Docs Agency')
  member = await addMember(owner.orgId, (await createUser('Meg Member')).id, 'member')
  outsider = await createOrgFor((await createUser('Out Sider')).id, 'Other Agency')
  const { key } = await withSystem((tx) => issueLicense(tx, { plan: 'agency', customerEmail: 'docs@example.com', source: 'manual' }))
  await activateLicense(owner, key)
  clientId = await createClient(owner, { name: 'Acme Plumbing', company: 'Acme LLC', email: 'client@acme.test', phone: null, website: 'https://acme-plumbing.com', industry: null, country: null, notes: 'internal only', status: 'active' })
})
beforeEach(() => __setModelClient(null))
afterAll(async () => {
  __setModelClient(null)
  await closeTestDatabase()
})

describe('proposal creation', () => {
  it('requires AI configuration for AI drafting (no fake success)', async () => {
    await expect(createProposal(owner, brief())).rejects.toMatchObject({ code: 'not_configured' })
  })

  it('creates a blank draft without AI', async () => {
    const id = await createProposal(owner, brief({ mode: 'blank' }))
    const { proposal, sections } = await getProposal(owner, id)
    expect(sections).toHaveLength(10)
    expect(sections.every((s) => !s.ai_generated)).toBe(true)
    expect(proposal.pricing_items).toEqual([{ item: 'Project fee', description: '', amount: 12000 }])
  })

  it('generates all sections, allocates the entered budget and logs usage', async () => {
    const fake = fakeModel([PROPOSAL_JSON])
    __setModelClient(fake.client)
    const id = await createProposal(owner, brief())
    const { proposal, sections } = await getProposal(owner, id)
    expect(sections.map((s) => s.key)).toEqual(['executive_summary', 'client_challenges', 'proposed_solution', 'scope_of_work', 'deliverables', 'timeline', 'pricing', 'payment_terms', 'terms_conditions', 'next_steps'])
    expect(sections.find((s) => s.key === 'timeline')?.content).toContain('Weeks 1–2')
    expect(proposal.pricing_items.map((p) => p.amount)).toEqual([4800, 7200])
    expect(proposal.total_amount).toBe(12000)
    expect(fake.calls[0].prompt).toContain('SEO Growth Program')
    expect(fake.calls[0].system).toContain('Do not invent')
    const usage = (await adminPool().query(`select feature, status, total_tokens, prompt_version from ai_usage_logs where organization_id = $1`, [owner.orgId])).rows
    expect(usage).toContainEqual({ feature: 'proposal', status: 'success', total_tokens: 300, prompt_version: 'proposal-v1.1' })
  })

  it('logs failed generations without saving a proposal', async () => {
    __setModelClient(fakeModel(['not json']).client)
    const before = (await adminPool().query('select count(*)::int n from proposals')).rows[0].n
    await expect(createProposal(owner, brief())).rejects.toMatchObject({ code: 'ai_failed' })
    expect((await adminPool().query('select count(*)::int n from proposals')).rows[0].n).toBe(before)
    const err = (await adminPool().query(`select error_code from ai_usage_logs where status = 'error' order by created_at desc limit 1`)).rows[0]
    expect(err.error_code).toMatch(/invalid_(json|output)/)
  })

  it('regenerates a single section and supports editing and duplication', async () => {
    __setModelClient(fakeModel([PROPOSAL_JSON, JSON.stringify({ content: 'Rewritten summary.' })]).client)
    const id = await createProposal(owner, brief())
    expect(await regenerateSection(owner, id, 'executive_summary', 'shorter')).toBe('Rewritten summary.')
    await updateSection(owner, id, 'next_steps', '- Sign\n- Pay deposit')
    const copyId = await duplicateProposal(owner, id)
    const copy = await getProposal(owner, copyId)
    expect(copy.proposal.title).toBe('SEO Growth Program (copy)')
    expect(copy.sections.find((s) => s.key === 'executive_summary')?.content).toBe('Rewritten summary.')
    expect(copy.sections.find((s) => s.key === 'next_steps')?.content).toContain('Pay deposit')
  })

  it('members can create proposals but cannot edit others’ proposals; outsiders see nothing', async () => {
    const ownerProposal = await createProposal(owner, brief({ mode: 'blank' }))
    await expect(updateSection(member, ownerProposal, 'deliverables', 'x')).rejects.toMatchObject({ code: 'forbidden' })
    await expect(deleteProposal(member, ownerProposal)).rejects.toMatchObject({ code: 'forbidden' })
    const mine = await createProposal(member, brief({ mode: 'blank' }))
    await updateSection(member, mine, 'deliverables', 'mine')
    await expect(getProposal(outsider, ownerProposal)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('rejects clients from another organization', async () => {
    await expect(createProposal(outsider, brief({ mode: 'blank' }))).rejects.toMatchObject({ code: 'validation' })
  })
})

describe('report generation and secure sharing', () => {
  let reportId: string
  let auditId: string

  beforeAll(async () => {
    const engine = await runAuditEngine('https://acme-plumbing.com/', {
      fetcher: async (url) => ({ url, status: url.endsWith('/') ? 200 : 404, headers: { 'content-type': 'text/html' }, body: Buffer.from(url.endsWith('/') ? GOOD_HTML : 'x'), transferBytes: 10, truncated: false, ttfbMs: 50, redirects: [] }),
    })
    const row = await adminPool().query(
      `insert into website_audits (organization_id, client_id, url, final_url, status, overall_score, category_scores, findings, issues, rules_version, created_by, completed_at)
       values ($1, $2, 'https://acme-plumbing.com/', 'https://acme-plumbing.com/', 'completed', $3, $4, $5, $6, $7, $8, now()) returning id`,
      [owner.orgId, clientId, engine.overall, json(engine.categories), json(engine.findings), json(engine.issues), RULES_VERSION, owner.userId],
    )
    auditId = row.rows[0].id
    const projectId = await createProject(owner, { name: 'Website rebuild', clientId, description: null, status: 'in_progress', deadline: null, budget: null, currency: 'USD', internalNotes: 'never share this' }, [])
    const t1 = await addTask(owner, projectId, { title: 'Design', description: null, assigneeId: null, dueDate: null })
    await addTask(owner, projectId, { title: 'Build', description: null, assigneeId: null, dueDate: null })
    await setTaskStatus(owner, t1, 'done')
  })

  it('builds sections from real audit and project data', async () => {
    reportId = await createReport(owner, { clientId, title: 'October Report', template: 'executive', periodStart: '2026-10-01', periodEnd: '2026-10-31', auditId })
    const { sections } = await getReport(owner, reportId)
    expect(sections.map((s) => s.kind)).toEqual(['summary', 'audit', 'projects', 'metrics', 'updates', 'next_steps'])
    expect(sections.find((s) => s.kind === 'projects')?.content).toContain('Website rebuild: In progress — 1 of 2 tasks complete (50%)')
    expect(sections.find((s) => s.kind === 'audit')?.content).toMatch(/Overall score: \d+\/100/)
  })

  it('rejects audits from other organizations', async () => {
    await expect(createReport(outsider, { clientId: null, title: 'X', template: 'executive', periodStart: null, periodEnd: null, auditId })).rejects.toMatchObject({ code: 'validation' })
  })

  it('generates an AI summary grounded in verified metrics', async () => {
    await updateMetrics(owner, reportId, [{ label: 'Organic sessions', value: '12,480', previous: '10,900', unit: '', source: 'GA4', note: '', verified: true }])
    const fake = fakeModel([JSON.stringify({ executive_summary: 'Organic sessions rose to 12,480 according to GA4, and the rebuild is half complete.', highlights: ['Sessions up'], concerns: [], next_steps: ['Finish build'] })])
    __setModelClient(fake.client)
    await generateReportSummary(owner, reportId)
    expect(fake.calls[0].prompt).toContain('12,480')
    expect(fake.calls[0].prompt).toContain('GA4')
    expect(fake.calls[0].prompt).not.toContain('never share this')
    const { sections } = await getReport(owner, reportId)
    expect(sections.find((s) => s.kind === 'summary')?.content).toContain('## Highlights')
    expect(sections.find((s) => s.kind === 'next_steps')?.content).toBe('- Finish build')
  })

  it('share links are random, hashed, hide disabled sections and can be revoked', async () => {
    const { sections } = await getReport(owner, reportId)
    const updates = sections.find((s) => s.kind === 'updates')!
    await updateReportSection(owner, reportId, updates.id, { title: updates.title, content: 'Internal draft', enabled: false })
    const { token } = await createShareLink(owner, reportId, 7)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const stored = (await adminPool().query('select token_hash from shared_reports where report_id = $1', [reportId])).rows[0]
    expect(stored.token_hash).not.toBe(token)
    const view = await getSharedReport(token, { countView: true })
    expect(view?.title).toBe('October Report')
    expect(view?.sections.some((s) => s.kind === 'updates')).toBe(false)
    expect(JSON.stringify(view)).not.toContain('internal only')
    expect(JSON.stringify(view)).not.toContain(owner.userId)
    expect(await getSharedReport(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'))).toBeNull()
    const share = (await getReport(owner, reportId)).shares[0]
    expect(share.view_count).toBe(1)
    await revokeShareLink(owner, reportId, share.id)
    expect(await getSharedReport(token)).toBeNull()
  })

  it('expired links stop working; members cannot create share links', async () => {
    const { token } = await createShareLink(owner, reportId, 7)
    await adminPool().query(`update shared_reports set expires_at = now() - interval '1 second' where revoked_at is null`)
    expect(await getSharedReport(token)).toBeNull()
    await expect(createShareLink(member, reportId, 7)).rejects.toMatchObject({ code: 'forbidden' })
  })
})

describe('onboarding documents', () => {
  it('generates the selected documents with checklist items and tracks progress', async () => {
    __setModelClient(
      fakeModel([
        JSON.stringify({
          documents: [
            { type: 'welcome_email', title: 'Welcome aboard', subject: 'Welcome to Docs Agency', content: 'Hi [Client name], welcome!' },
            { type: 'checklist', title: 'Onboarding checklist', content: 'Steps', items: ['Sign contract', 'Share analytics access', 'Book kickoff'] },
          ],
        }),
      ]).client,
    )
    const kitId = await createOnboardingKit(owner, { clientId, projectId: null, projectType: 'SEO campaign', requirements: 'Local SEO', types: ['welcome_email', 'checklist'] })
    const { docs } = await getOnboardingKit(owner, kitId)
    expect(docs.map((d) => d.doc_type)).toEqual(['welcome_email', 'checklist'])
    const checklist = docs.find((d) => d.doc_type === 'checklist')!
    expect(checklist.items).toHaveLength(3)
    expect(computeProgress(docs)).toEqual({ done: 0, total: 4, percent: 0 })
    await setChecklistItems(owner, kitId, checklist.id, checklist.items.map((i) => ({ ...i, done: true })))
    const after = await getOnboardingKit(owner, kitId)
    expect(after.docs.find((d) => d.id === checklist.id)?.status).toBe('completed')
    expect(computeProgress(after.docs).percent).toBe(75)
  })

  it('never sends email without a configured provider', async () => {
    const kitId = await createOnboardingKit(owner, { clientId, projectId: null, projectType: 'Branding', requirements: '', types: ['welcome_email'] })
    const { docs } = await getOnboardingKit(owner, kitId)
    await expect(sendWelcomeEmail(owner, kitId, docs[0].id)).rejects.toMatchObject({ code: 'not_configured' })
    await expect(sendWelcomeEmail(member, kitId, docs[0].id)).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('requires the reporting/onboarding module (plan gating)', async () => {
    const { key } = await withSystem((tx) => issueLicense(tx, { plan: 'standard', customerEmail: 's@example.com', source: 'manual' }))
    const std = await createOrgFor((await createUser('Std Owner')).id, 'Standard Agency')
    await activateLicense(std, key)
    const c = await createClient(std, { name: 'C', company: null, email: null, phone: null, website: null, industry: null, country: null, notes: null, status: 'active' })
    await expect(createOnboardingKit(std, { clientId: c, projectId: null, projectType: 'SEO campaign', requirements: '', types: ['checklist'] })).rejects.toMatchObject({ code: 'limit_reached' })
    await expect(createReport(std, { clientId: c, title: 'R', template: 'executive', periodStart: null, periodEnd: null, auditId: null })).rejects.toMatchObject({ code: 'limit_reached' })
  })
})

describe('website audit service', () => {
  it('validates URLs before any network access (SSRF)', async () => {
    for (const url of ['http://localhost/', 'http://169.254.169.254/', 'file:///etc/passwd', 'http://10.0.0.1/']) {
      await expect(runAudit(member, { url, clientId: null })).rejects.toMatchObject({ code: 'validation' })
    }
    expect((await adminPool().query('select count(*)::int n from website_audits where url like $1', ['%169.254%'])).rows[0].n).toBe(0)
  })

  it('rejects clients from another organization', async () => {
    await expect(runAudit(outsider, { url: 'https://example.org/', clientId })).rejects.toMatchObject({ code: 'validation' })
  })

  it('stores sanitized AI analysis for measured findings', async () => {
    const id = (await adminPool().query(`select id from website_audits where organization_id = $1 limit 1`, [owner.orgId])).rows[0].id as string
    const audit = await getAudit(owner, id)
    const issueId = audit.issues![0]?.id ?? 'tech.structured_data_missing'
    __setModelClient(
      fakeModel([
        JSON.stringify({
          executive_summary: 'The site is in good health with a few improvements available for search visibility.',
          overall_assessment: 'Solid foundation.',
          priority_recommendations: [
            { issue_id: issueId, title: 'Fix it', rationale: 'Because', action: 'Do X', impact: 'medium', effort: 'low' },
            { issue_id: 'invented.issue', title: 'Fake', rationale: 'x', action: 'y', impact: 'high', effort: 'low' },
          ],
          issue_explanations: [],
          opportunities: ['Publish more local content'],
          next_steps: ['Fix the top issue'],
          conclusion: 'Good overall.',
        }),
      ]).client,
    )
    await regenerateAuditAnalysis(owner, id)
    const after = await getAudit(owner, id)
    expect(after.ai_status).toBe('completed')
    expect(after.ai_analysis?.priority_recommendations.map((r) => r.issue_id)).toEqual(audit.issues!.length ? [issueId] : [])
    expect(after.overall_score).toBe(audit.overall_score)
  })

  it('outsiders cannot read or re-analyse audits', async () => {
    const id = (await adminPool().query(`select id from website_audits where organization_id = $1 limit 1`, [owner.orgId])).rows[0].id as string
    await expect(getAudit(outsider, id)).rejects.toBeInstanceOf(AppError)
    await expect(regenerateAuditAnalysis(outsider, id)).rejects.toMatchObject({ code: 'not_found' })
    const rows = await withUser(outsider.userId, (tx) => tx.selectFrom('website_audits').select('id').execute())
    expect(rows).toHaveLength(0)
  })
})
