import 'server-only'
import { PGlite } from '@electric-sql/pglite'
import { Kysely, PGliteDialect, sql } from 'kysely'
import type { Database } from './types'
import { MIGRATIONS } from './migrations.generated'
import { PREVIEW_USER } from '@/lib/preview'
import { runAuditEngine } from '@/lib/audit/run'

/**
 * In-memory Postgres for preview mode. Runs the real migrations, then seeds a
 * sample agency. Each server instance has its own copy; changes made while
 * previewing can reset when the instance is recycled.
 */
export async function createPreviewDatabase(): Promise<PGlite> {
  const pg = new PGlite({ parsers: { 20: Number, 1700: Number, 1082: (v: string) => v } })
  await pg.waitReady
  for (const [, body] of MIGRATIONS) {
    // gen_random_uuid() is built into Postgres 13+; PGlite has no pgcrypto bundle.
    await pg.exec(body.replace(/create extension if not exists pgcrypto;/i, ''))
  }
  const db = new Kysely<Database>({ dialect: new PGliteDialect({ pglite: pg }) })
  await seed(db)
  return pg
}

const day = 86400_000
const ago = (d: number) => new Date(Date.now() - d * day)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const j = (v: unknown) => JSON.stringify(v)

const SAMPLE_SITE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brightside Dental — Family Dentist</title>
<link rel="canonical" href="https://brightside-dental.example/">
<script src="/js/jquery.min.js"></script><script src="/js/slider.js"></script><script src="/js/chat-widget.js"></script><script src="/js/analytics.js"></script>
<link rel="stylesheet" href="/css/a.css"><link rel="stylesheet" href="/css/b.css"><link rel="stylesheet" href="/css/c.css"><link rel="stylesheet" href="/css/d.css"><link rel="stylesheet" href="/css/e.css">
</head><body>
<header><nav><a href="/">Home</a><a href="/services">Services</a><a href="/team">Our team</a><a href="/contact">Contact</a></nav></header>
<main>
<h1>Gentle family dentistry in Austin</h1>
<p>${'We provide check-ups, cleanings, whitening and emergency appointments for the whole family. '.repeat(12)}</p>
<h3>Why patients choose us</h3>
<p>${'Modern equipment, flexible hours and a friendly team that explains every step of your treatment plan. '.repeat(6)}</p>
<img src="/img/hero.jpg"><img src="/img/team.png" alt="IMG_2041.png"><img src="/img/office.jpg" alt="Our reception area" width="800" height="500">
<form><input type="text" name="name" placeholder="Your name"><input type="email" name="email" placeholder="Email"><button>Send</button></form>
<a href="/old-offers"><svg></svg></a>
</main><footer>© Brightside Dental</footer></body></html>`

async function seed(db: Kysely<Database>) {
  const u = PREVIEW_USER
  await db.insertInto('user').values({ id: u.id, name: u.name, email: u.email, emailVerified: true, image: null, createdAt: ago(40), updatedAt: ago(40) }).execute()
  const teammates = [
    { id: 'preview_admin', name: 'Priya Shah', email: 'priya@northwind-digital.example' },
    { id: 'preview_member', name: 'Tom Becker', email: 'tom@northwind-digital.example' },
  ]
  for (const t of teammates) await db.insertInto('user').values({ ...t, emailVerified: true, image: null, createdAt: ago(30), updatedAt: ago(30) }).execute()

  await sql`select set_config('app.user_id', ${u.id}, false)`.execute(db)
  const { rows } = await sql<{ id: string }>`select app.create_organization('Northwind Digital', 'https://northwind-digital.example', 'SEO & web agency', 'United States', 'hello@northwind-digital.example', '#6D6AF5') as id`.execute(db)
  const orgId = rows[0].id
  await db.insertInto('organization_members').values([
    { organization_id: orgId, user_id: 'preview_admin', role: 'admin' },
    { organization_id: orgId, user_id: 'preview_member', role: 'member' },
  ]).execute()
  await db.updateTable('branding_settings').set({ report_title_default: 'Monthly Performance Report', report_footer: 'Northwind Digital · northwind-digital.example', contact_phone: '+1 (512) 555-0142', contact_website: 'https://northwind-digital.example', white_label_enabled: true }).where('organization_id', '=', orgId).execute()

  // Agency license so every module is unlocked in the preview.
  const lic = await db
    .insertInto('license_keys')
    .values({ key_hash: 'preview', key_encrypted: 'preview', key_last4: 'PRVW', plan: 'agency', status: 'active', source: 'manual', customer_email: u.email, customer_name: u.name, notes: 'Preview mode sample license' })
    .returning('id')
    .executeTakeFirstOrThrow()
  await db.insertInto('license_activations').values({ license_key_id: lic.id, organization_id: orgId, activated_by: u.id }).execute()

  const clients = await db
    .insertInto('clients')
    .values([
      { organization_id: orgId, name: 'Maria Chen', company: 'Brightside Dental', email: 'maria@brightside-dental.example', phone: '+1 512 555 0101', website: 'https://brightside-dental.example', industry: 'Healthcare', country: 'United States', status: 'active', notes: 'Wants more new-patient bookings from local search.', created_by: u.id },
      { organization_id: orgId, name: 'David Okafor', company: 'Okafor Legal', email: 'david@okafor-legal.example', phone: '+44 20 7946 0102', website: 'https://okafor-legal.example', industry: 'Legal services', country: 'United Kingdom', status: 'active', notes: 'Rebrand and new site in Q1.', created_by: u.id },
      { organization_id: orgId, name: 'Sofia Martins', company: 'Verde Coffee Roasters', email: 'sofia@verde-coffee.example', phone: null, website: 'https://verde-coffee.example', industry: 'E-commerce', country: 'Portugal', status: 'lead', notes: 'Inbound lead — interested in Shopify SEO.', created_by: u.id },
      { organization_id: orgId, name: 'James Whitfield', company: 'Whitfield Builders', email: 'james@whitfield-builders.example', phone: '+1 512 555 0177', website: 'https://whitfield-builders.example', industry: 'Construction', country: 'United States', status: 'paused', notes: null, created_by: u.id },
    ])
    .returning(['id', 'name'])
    .execute()
  const [dental, legal, coffee] = clients

  const projects = await db
    .insertInto('projects')
    .values([
      { organization_id: orgId, client_id: dental.id, name: 'Local SEO growth program', description: 'Rank for "dentist near me" terms across three Austin neighbourhoods.', status: 'in_progress', deadline: iso(new Date(Date.now() + 45 * day)), budget: 9600, currency: 'USD', internal_notes: 'Client prefers Friday status calls.', created_by: u.id },
      { organization_id: orgId, client_id: legal.id, name: 'Website rebuild', description: 'New brand, 12-page site, migration from WordPress.', status: 'review', deadline: iso(new Date(Date.now() + 12 * day)), budget: 18500, currency: 'GBP', internal_notes: null, created_by: u.id },
      { organization_id: orgId, client_id: coffee.id, name: 'Shopify SEO audit & roadmap', description: null, status: 'planning', deadline: iso(new Date(Date.now() + 30 * day)), budget: 3200, currency: 'EUR', internal_notes: null, created_by: u.id },
    ])
    .returning(['id'])
    .execute()
  await db.insertInto('project_members').values([
    { project_id: projects[0].id, organization_id: orgId, user_id: 'preview_member' },
    { project_id: projects[1].id, organization_id: orgId, user_id: 'preview_admin' },
  ]).execute()
  const tasks: [number, string, 'todo' | 'in_progress' | 'done', string | null][] = [
    [0, 'Google Business Profile optimisation', 'done', 'preview_member'],
    [0, 'Fix missing alt text and H1 issues from audit', 'done', 'preview_member'],
    [0, 'Publish 4 neighbourhood landing pages', 'in_progress', 'preview_member'],
    [0, 'Citation clean-up (top 30 directories)', 'todo', null],
    [1, 'Homepage design sign-off', 'done', 'preview_admin'],
    [1, 'Content migration', 'done', 'preview_admin'],
    [1, 'Client review of staging site', 'in_progress', null],
    [1, '301 redirect map', 'todo', 'preview_admin'],
    [2, 'Kick-off call', 'todo', u.id],
  ]
  await db.insertInto('project_tasks').values(tasks.map(([p, title, status, assignee], i) => ({ organization_id: orgId, project_id: projects[p].id, title, status, assignee_id: assignee, position: i, completed_at: status === 'done' ? ago(3) : null, created_by: u.id }))).execute()

  // A real audit result produced by the audit engine on a sample page.
  const engine = await runAuditEngine('https://brightside-dental.example/', {
    fetcher: async (url) => {
      const isHome = /example\/$/.test(url)
      const robots = url.endsWith('/robots.txt')
      const body = isHome ? SAMPLE_SITE : robots ? 'User-agent: *\nAllow: /' : url.includes('old-offers') ? 'Not found' : 'ok'
      const buf = Buffer.from(body)
      return { url, status: url.includes('old-offers') || url.includes('sitemap') ? 404 : 200, headers: { 'content-type': robots ? 'text/plain' : url.match(/\.(jpg|png)$/) ? 'image/jpeg' : 'text/html', 'content-length': url.includes('hero.jpg') ? '640000' : String(buf.length) }, body: buf, transferBytes: buf.length, truncated: false, ttfbMs: 420, redirects: [] }
    },
  })
  const issueIds = engine.issues.map((i) => i.id)
  const top = engine.issues.filter((i) => i.severity !== 'info').slice(0, 4)
  const audit = await db
    .insertInto('website_audits')
    .values({
      organization_id: orgId,
      client_id: dental.id,
      url: 'https://brightside-dental.example/',
      final_url: 'https://brightside-dental.example/',
      status: 'completed',
      overall_score: engine.overall,
      category_scores: j(engine.categories),
      findings: j(engine.findings),
      issues: j(engine.issues),
      ai_status: 'completed',
      ai_analysis: j({
        executive_summary: `Brightside Dental's homepage scores ${engine.overall}/100. The site has a clear structure and mobile viewport, but missing image descriptions, an unlabeled contact form and a missing XML sitemap are holding back both accessibility and search visibility. Fixing the priority items below is low effort and should be done first.`,
        overall_assessment: 'Solid foundation with several quick wins in accessibility, technical SEO and page speed.',
        priority_recommendations: top.map((i) => ({ issue_id: i.id, title: i.title, rationale: i.explanation, action: i.recommendation, impact: i.severity === 'high' || i.severity === 'critical' ? 'high' : 'medium', effort: 'low' })),
        issue_explanations: [],
        opportunities: ['Add LocalBusiness structured data with opening hours and reviews.', 'Create dedicated pages for each treatment to target specific searches.'],
        next_steps: ['Publish an XML sitemap and submit it in Search Console.', 'Label the contact form fields and add alt text to all images.', 'Defer non-critical scripts in the page head.'],
        conclusion: 'With the fixes above the site should be well placed to compete in local search.',
      }),
      rules_version: engine.rulesVersion,
      prompt_version: 'audit-v1.2',
      created_by: u.id,
      completed_at: ago(6),
      created_at: ago(6),
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  void issueIds

  const brief = { clientName: 'David Okafor', clientCompany: 'Okafor Legal', projectTitle: 'Website rebuild & SEO foundation', projectDescription: 'A new brand-aligned website that generates qualified enquiries.', requirements: '12 pages, CMS, fast and accessible', services: 'Design, development, technical SEO', deliverables: 'Design system, website, SEO setup', budget: 18500, currency: 'GBP', timeline: '10 weeks', paymentTerms: '40% upfront, 40% at staging, 20% at launch', notes: '', agencyName: 'Northwind Digital' }
  const proposal = await db
    .insertInto('proposals')
    .values({ organization_id: orgId, client_id: legal.id, title: 'Website rebuild & SEO foundation', template: 'consulting', status: 'sent', brief: j(brief), pricing_items: j([{ item: 'Discovery & design', description: 'Workshops, sitemap, design system', amount: 5550 }, { item: 'Development', description: '12 pages, CMS, integrations', amount: 9250 }, { item: 'Technical SEO & launch', description: 'Redirects, schema, analytics', amount: 3700 }]), currency: 'GBP', total_amount: 18500, valid_until: iso(new Date(Date.now() + 21 * day)), prompt_version: 'proposal-v1.1', created_by: u.id, created_at: ago(9) })
    .returning('id')
    .executeTakeFirstOrThrow()
  const sections: [string, string, string][] = [
    ['executive_summary', 'Executive Summary', 'Okafor Legal needs a website that reflects its new brand and turns visitors into qualified enquiries.\n\nWe propose a ten-week engagement to design and build a fast, accessible site on a modern CMS, with the technical SEO foundations in place from day one.'],
    ['client_challenges', 'Understanding Your Challenges', '- The current WordPress site is slow and hard for your team to update\n- Practice-area pages do not rank for the services clients search for\n- The enquiry form is not tracked, so marketing results are unclear'],
    ['proposed_solution', 'Proposed Solution', 'A three-phase approach: discovery and design, development, then launch with search visibility protected through a complete redirect plan.'],
    ['scope_of_work', 'Scope of Work', '## Design\n- Brand-aligned design system\n- Templates for 12 pages\n\n## Development\n- Headless CMS with editor training\n- Contact form with conversion tracking\n\n## SEO\n- Redirect map, structured data, analytics setup'],
    ['deliverables', 'Deliverables', '- Design system and page designs\n- Production website\n- Redirect map and SEO configuration\n- Editor training session'],
    ['timeline', 'Project Timeline', '- Weeks 1–2: Discovery and sitemap\n- Weeks 3–5: Design\n- Weeks 6–9: Development and content migration\n- Week 10: QA and launch'],
    ['pricing', 'Investment', 'The fixed fee below covers everything in the scope of work.'],
    ['payment_terms', 'Payment Terms', '40% on signature, 40% when the staging site is approved and 20% at launch. Invoices are payable within 14 days.'],
    ['terms_conditions', 'Terms & Conditions', 'Changes to scope are quoted separately. Intellectual property transfers on final payment. This template should be reviewed before signing.'],
    ['next_steps', 'Next Steps', '- Approve this proposal\n- Schedule the discovery workshop\n- Share access to the current website and analytics'],
  ]
  await db.insertInto('proposal_sections').values(sections.map(([key, title, content], i) => ({ organization_id: orgId, proposal_id: proposal.id, key, title, content, position: i, ai_generated: true }))).execute()

  const report = await db
    .insertInto('reports')
    .values({ organization_id: orgId, client_id: dental.id, audit_id: audit.id, title: 'October Performance Report', template: 'executive', status: 'final', period_start: '2026-10-01', period_end: '2026-10-31', metrics: j([{ label: 'Organic sessions', value: '4,820', previous: '3,910', unit: '', source: 'GA4', note: '', verified: true }, { label: 'Booking requests', value: '63', previous: '48', unit: '', source: 'Practice CRM', note: '', verified: true }, { label: 'Map pack views', value: '12,300', previous: '9,800', unit: '', source: 'Google Business Profile', note: '', verified: true }]), created_by: u.id, created_at: ago(2) })
    .returning('id')
    .executeTakeFirstOrThrow()
  const rsections: ['summary' | 'audit' | 'projects' | 'metrics' | 'updates' | 'next_steps', string, string][] = [
    ['summary', 'Executive Summary', 'October was a strong month: organic sessions grew to 4,820 and booking requests reached 63, both reported from your GA4 and practice CRM.\n\n## Highlights\n- Google Business Profile optimisation completed\n- Accessibility fixes from the audit shipped\n\n## Areas of attention\n- Neighbourhood landing pages are still in progress'],
    ['audit', 'Website Health', `Website audit completed with an overall score of ${engine.overall}/100.`],
    ['projects', 'Project Progress', '- Local SEO growth program: In progress — 2 of 4 tasks complete (50%)'],
    ['metrics', 'Key Metrics', ''],
    ['updates', 'Work Completed This Period', '- Optimised Google Business Profile categories and services\n- Added alt text to all homepage images\n- Fixed the homepage H1'],
    ['next_steps', 'Next Steps', '- Publish four neighbourhood landing pages\n- Start citation clean-up'],
  ]
  await db.insertInto('report_sections').values(rsections.map(([kind, title, content], i) => ({ organization_id: orgId, report_id: report.id, kind, title, content, position: i, ai_generated: kind === 'summary' }))).execute()

  const kit = await db
    .insertInto('onboarding_kits')
    .values({ organization_id: orgId, client_id: coffee.id, project_id: projects[2].id, title: 'Sofia Martins — SEO campaign onboarding', project_type: 'SEO campaign', requirements: 'Shopify store, 140 products, ships across the EU.', created_by: u.id, created_at: ago(1) })
    .returning('id')
    .executeTakeFirstOrThrow()
  const checklist = ['Sign the agreement', 'Share Shopify staff access', 'Grant GA4 and Search Console access', 'Send brand guidelines', 'Book the kickoff call'].map((label, i) => ({ id: `chk-${i}`, label, done: i < 2 }))
  await db.insertInto('onboarding_documents').values([
    { organization_id: orgId, kit_id: kit.id, doc_type: 'welcome_email', title: 'Welcome to Northwind Digital', subject: 'Welcome aboard, Verde Coffee Roasters!', content: 'Hi Sofia,\n\nWelcome to Northwind Digital — we are excited to help Verde Coffee Roasters grow its organic sales.\n\nOver the next week we will set up access, review your store and agree the first priorities on our kickoff call.\n\nBest,\nJordan', status: 'ready', position: 0, created_by: u.id },
    { organization_id: orgId, kit_id: kit.id, doc_type: 'checklist', title: 'Onboarding checklist', subject: null, content: 'Complete these steps so we can start work.', items: j(checklist), status: 'ready', position: 1, created_by: u.id },
    { organization_id: orgId, kit_id: kit.id, doc_type: 'kickoff_agenda', title: 'Kickoff meeting agenda', subject: null, content: '## 45 minutes\n- 5 min: Introductions\n- 15 min: Goals and current performance\n- 15 min: SEO roadmap and first 30 days\n- 10 min: Communication and next steps', status: 'draft', position: 2, created_by: u.id },
  ]).execute()

  const activity: [string, string, number][] = [
    ['report.created', 'Created report "October Performance Report"', 0.1],
    ['audit.completed', `Audited brightside-dental.example — score ${engine.overall}`, 6],
    ['proposal.created', 'Created proposal "Website rebuild & SEO foundation" with AI', 9],
    ['onboarding.created', 'Generated 3 onboarding documents with AI for Sofia Martins', 1],
    ['task.completed', 'Completed task "Fix missing alt text and H1 issues from audit"', 3],
    ['client.created', 'Added client Sofia Martins', 2],
  ]
  await db.insertInto('activity_logs').values(activity.map(([action, summary, d], i) => ({ organization_id: orgId, actor_id: i % 3 === 1 ? 'preview_admin' : i % 3 === 2 ? 'preview_member' : u.id, action, entity_type: action.split('.')[0], summary, metadata: '{}', created_at: ago(d) }))).execute()
  await db.insertInto('ai_usage_logs').values(Array.from({ length: 14 }, (_, i) => ({ organization_id: orgId, user_id: u.id, feature: (['audit', 'proposal', 'report', 'onboarding', 'proposal_section'] as const)[i % 5], model: 'gemini-3.5-flash', prompt_version: 'v1', status: 'success' as const, input_tokens: 1800, output_tokens: 1200, total_tokens: 3000, latency_ms: 4200, created_at: ago(i * 2) }))).execute()
}
