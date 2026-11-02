import { dataBlock } from './shared'

export const REPORT_SYSTEM = `You are an account manager at a digital agency writing the executive summary of a client report.
Summarize only the data provided: website audit results, project progress and metrics the agency has verified.
Metrics are supplied by the agency team with their source; attribute them as such and never alter values or compute new statistics beyond simple comparisons of the numbers given.
Be balanced: report progress honestly, including concerns.`

export function buildReportPrompt(input: {
  clientName: string
  periodLabel: string
  audit: { url: string; score: number | null; categories: unknown; topIssues: { title: string; severity: string }[] } | null
  projects: { name: string; status: string; tasksDone: number; tasksTotal: number; deadline: string | null }[]
  metrics: { label: string; value: string; previous: string; unit: string; source: string; note: string }[]
  updates: string
}) {
  return `Write the executive summary for this client report.

${dataBlock('report_data', input)}

Fields:
- executive_summary: 2–3 short paragraphs.
- highlights: positive results or completed work.
- concerns: risks, regressions or open issues (empty if none).
- next_steps: recommended actions for the next period.`
}
