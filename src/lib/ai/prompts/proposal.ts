import { dataBlock } from './shared'
import type { ProposalSectionKey } from '../schemas/proposal.schema'

export type ProposalBrief = {
  clientName: string
  clientCompany: string | null
  projectTitle: string
  projectDescription: string
  requirements: string
  services: string
  deliverables: string
  budget: number | null
  currency: string
  timeline: string
  paymentTerms: string
  notes: string
  agencyName: string
}

export const PROPOSAL_SYSTEM = `You are an experienced agency principal writing a client proposal for a digital agency (SEO, marketing or web development).
The proposal must read like a real consulting document: specific to the brief, structured, confident and professional — never generic filler.
Use "we" for the agency and address the client directly. Use "- " bullet lines for lists.
Do not invent agency credentials, past clients, case studies, awards, team sizes, testimonials or guarantees of results (e.g. rankings or revenue).
Do not invent prices: pricing is split as percentages of the budget provided; if no budget is given, describe pricing as "to be confirmed".`

export function buildProposalPrompt(brief: ProposalBrief) {
  return `Draft a complete proposal from this brief.

${dataBlock('brief', brief)}

Field guidance:
- executive_summary: 2 short paragraphs on the client's goal and the outcome of the engagement.
- client_challenges: the challenges implied by the brief, as bullet lines with one-sentence explanations.
- proposed_solution: the approach, phases and why it fits.
- scope_of_work: bullet lines grouped by workstream; include what is out of scope if implied.
- deliverables: bullet lines of concrete deliverables based on the brief.
- timeline: phases with durations that fit the stated timeline (e.g. "- Week 1–2: Discovery …").
- pricing_intro: one paragraph introducing the investment${brief.budget ? ` of ${brief.currency} ${brief.budget}` : ' (budget not yet provided — say pricing will be confirmed)'}.
- pricing_items: 2–6 line items with share_percent values that sum to 100${brief.budget ? '' : ' (amounts will be confirmed later)'}.
- payment_terms: based on the stated payment terms; if none, propose a standard structure and label it as proposed.
- terms_conditions: a concise template covering scope changes, client responsibilities, intellectual property, confidentiality, termination and limitation of liability. Note it should be reviewed before signing.
- next_steps: 3–5 bullet lines to move forward.`
}

export function buildSectionPrompt(brief: ProposalBrief, key: ProposalSectionKey, title: string, current: Record<string, string>, instructions: string) {
  return `Rewrite one section of an existing proposal.

${dataBlock('brief', brief)}
${dataBlock('other_sections', Object.fromEntries(Object.entries(current).filter(([k]) => k !== key).map(([k, v]) => [k, v.slice(0, 1500)])))}
${dataBlock('current_section', { key, title, content: current[key] ?? '' })}
${instructions ? dataBlock('editor_instructions', instructions.slice(0, 1000)) : ''}

Return JSON with "content": the new text for the "${title}" section only, consistent with the other sections.`
}
