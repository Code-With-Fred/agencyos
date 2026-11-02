import { z } from 'zod'

export const PROPOSAL_SECTIONS = [
  { key: 'executive_summary', title: 'Executive Summary' },
  { key: 'client_challenges', title: 'Understanding Your Challenges' },
  { key: 'proposed_solution', title: 'Proposed Solution' },
  { key: 'scope_of_work', title: 'Scope of Work' },
  { key: 'deliverables', title: 'Deliverables' },
  { key: 'timeline', title: 'Project Timeline' },
  { key: 'pricing', title: 'Investment' },
  { key: 'payment_terms', title: 'Payment Terms' },
  { key: 'terms_conditions', title: 'Terms & Conditions' },
  { key: 'next_steps', title: 'Next Steps' },
] as const
export type ProposalSectionKey = (typeof PROPOSAL_SECTIONS)[number]['key']
export const PROPOSAL_SECTION_KEYS = PROPOSAL_SECTIONS.map((s) => s.key) as [ProposalSectionKey, ...ProposalSectionKey[]]

const text = (max = 6000) => z.string().min(1).max(max)

export const proposalAiSchema = z.object({
  executive_summary: text(),
  client_challenges: text(),
  proposed_solution: text(),
  scope_of_work: text(8000),
  deliverables: text(),
  timeline: text(),
  pricing_intro: text(2000).describe('Short paragraph introducing the investment'),
  pricing_items: z
    .array(z.object({ item: z.string().min(1).max(160), description: z.string().max(400), share_percent: z.number().min(0).max(100).describe('Share of the total budget') }))
    .max(12),
  payment_terms: text(),
  terms_conditions: text(8000),
  next_steps: text(),
})
export type ProposalAi = z.infer<typeof proposalAiSchema>

export const proposalSectionAiSchema = z.object({ content: text(8000) })

export type PricingItem = { item: string; description: string; amount: number | null }

/**
 * Converts AI percentage splits into amounts that sum exactly to the budget
 * the user entered. Without a budget, no amounts are produced.
 */
export function allocateBudget(items: ProposalAi['pricing_items'], budget: number | null): PricingItem[] {
  if (!items.length) return budget ? [{ item: 'Project fee', description: '', amount: budget }] : []
  if (budget === null) return items.map((i) => ({ item: i.item, description: i.description, amount: null }))
  const total = items.reduce((s, i) => s + i.share_percent, 0)
  const weights = total > 0 ? items.map((i) => i.share_percent / total) : items.map(() => 1 / items.length)
  const cents = Math.round(budget * 100)
  const raw = weights.map((w) => Math.floor(w * cents))
  let remainder = cents - raw.reduce((a, b) => a + b, 0)
  for (let i = 0; remainder > 0; i = (i + 1) % raw.length, remainder--) raw[i]++
  return items.map((it, i) => ({ item: it.item, description: it.description, amount: raw[i] / 100 }))
}
