import type { CategoryScores, Findings, Issue } from '@/lib/audit/types'
import { dataBlock } from './shared'

export const AUDIT_SYSTEM = `You are a senior SEO, web performance and conversion consultant writing the analysis section of a website audit for an agency's client.
You receive measured findings produced by automated checks. Your job is to explain them in plain English, prioritize them by business impact, recommend concrete fixes, identify opportunities and write an executive summary.
You must not change, add or estimate any measurement or score. Only reference issues by the exact issue_id values provided.
Items marked "estimate": true are automated approximations — describe them as estimates.
If Core Web Vitals were not measured, do not speculate about them.`

/** Compact, factual payload — never raw HTML. */
export function buildAuditPrompt(input: { url: string; overall: number; categories: CategoryScores; issues: Issue[]; findings: Findings; clientName?: string | null }) {
  const f = input.findings
  const facts = {
    url: f.fetch.finalUrl,
    client: input.clientName ?? undefined,
    overall_score: input.overall,
    category_scores: input.categories,
    page: {
      title: f.page.title,
      meta_description: f.page.metaDescription,
      word_count: f.page.wordCount,
      h1: f.page.headings.filter((h) => h.level === 1).map((h) => h.text).slice(0, 3),
      structured_data_types: f.page.structuredData.types,
    },
    measurements: {
      http_status: f.fetch.status,
      html_kb: Math.round(f.fetch.htmlBytes / 1024),
      compression: f.fetch.contentEncoding ?? 'none',
      internal_links_checked: f.links.checked,
      broken_links: f.links.broken.length,
      sitemap_found: f.sitemap.found,
      robots_txt_found: f.robots.found,
      pagespeed: f.pagespeed ? { lab_performance_score: f.pagespeed.lab.performanceScore, field_data_available: f.pagespeed.field.available } : 'not measured',
    },
    issues: input.issues.map((i) => ({ issue_id: i.id, category: i.category, severity: i.severity, title: i.title, evidence: i.evidence, estimate: i.estimate ?? false })),
    passed_checks: f.checks.filter((c) => c.status === 'pass').map((c) => c.label),
  }
  return `Write the audit analysis for this website.

${dataBlock('audit_findings', facts)}

Requirements:
- executive_summary: 3–5 sentences a business owner understands; mention the overall score and the most important problems.
- priority_recommendations: up to 8 items ordered by business impact (critical issues first); each must reference an existing issue_id.
- issue_explanations: one entry per issue (same issue_id) with a plain-English explanation and a specific recommended fix.
- opportunities: improvements beyond fixing errors, grounded in the findings.
- next_steps: concrete actions for the next 30 days.
- conclusion: a short closing paragraph.`
}
