import { z } from 'zod'

export const auditAiSchema = z.object({
  executive_summary: z.string().min(40).max(3000).describe('3-5 sentence summary for a business owner'),
  overall_assessment: z.string().min(10).max(1000).describe('One paragraph on overall site health'),
  priority_recommendations: z
    .array(
      z.object({
        issue_id: z.string().max(80).describe('Must be one of the provided issue ids'),
        title: z.string().max(160),
        rationale: z.string().max(700),
        action: z.string().max(700),
        impact: z.enum(['high', 'medium', 'low']),
        effort: z.enum(['high', 'medium', 'low']),
      }),
    )
    .max(10),
  issue_explanations: z
    .array(
      z.object({
        issue_id: z.string().max(80),
        plain_english: z.string().max(900),
        recommended_fix: z.string().max(900),
      }),
    )
    .max(60),
  opportunities: z.array(z.string().max(500)).max(8),
  next_steps: z.array(z.string().max(400)).max(8),
  conclusion: z.string().max(1500),
})
export type AuditAi = z.infer<typeof auditAiSchema>

/** Drops references to issues that do not exist — the AI cannot add findings. */
export function sanitizeAuditAi(ai: AuditAi, issueIds: Set<string>): AuditAi {
  const seen = new Set<string>()
  return {
    ...ai,
    priority_recommendations: ai.priority_recommendations.filter((r) => issueIds.has(r.issue_id) && !seen.has(r.issue_id) && (seen.add(r.issue_id), true)),
    issue_explanations: ai.issue_explanations.filter((e) => issueIds.has(e.issue_id)),
  }
}
