import { CATEGORIES, type Category, type CategoryScores, type Issue, type Severity } from './types'

/**
 * Transparent scoring rules (also shown in the report):
 *  - Each category starts at 100.
 *  - Each issue deducts points by severity (critical 30, high 15, medium 8, low 3, info 0).
 *  - Category scores are floored at 0.
 *  - Overall score is the weighted average of category scores.
 */
export const SEVERITY_PENALTY: Record<Severity, number> = { critical: 30, high: 15, medium: 8, low: 3, info: 0 }
export const CATEGORY_WEIGHTS: Record<Category, number> = { technical: 0.3, content: 0.2, performance: 0.2, accessibility: 0.15, conversion: 0.15 }

export function scoreAudit(issues: Pick<Issue, 'category' | 'severity'>[]): { overall: number; categories: CategoryScores } {
  const categories = Object.fromEntries(CATEGORIES.map((c) => [c, 100])) as CategoryScores
  for (const issue of issues) {
    categories[issue.category] = Math.max(0, categories[issue.category] - SEVERITY_PENALTY[issue.severity])
  }
  const overall = Math.round(CATEGORIES.reduce((sum, c) => sum + categories[c] * CATEGORY_WEIGHTS[c], 0))
  return { overall, categories }
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 55) return 'Needs improvement'
  return 'Poor'
}

export const SCORING_EXPLANATION =
  'Each category starts at 100 points. Every issue found deducts points by severity — Critical 30, High 15, Medium 8, Low 3, Informational 0 — with a minimum of 0. The overall score is a weighted average: Technical SEO 30%, Content 20%, Performance 20%, Accessibility 15%, Conversion & UX 15%.'
