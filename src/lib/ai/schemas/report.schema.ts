import { z } from 'zod'

export const reportAiSchema = z.object({
  executive_summary: z.string().min(40).max(4000),
  highlights: z.array(z.string().max(400)).max(8),
  concerns: z.array(z.string().max(400)).max(8),
  next_steps: z.array(z.string().max(400)).max(8),
})
export type ReportAi = z.infer<typeof reportAiSchema>

export const metricSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(60),
  previous: z.string().trim().max(60).optional().default(''),
  unit: z.string().trim().max(20).optional().default(''),
  source: z.string().trim().min(1, 'Source is required').max(120),
  note: z.string().trim().max(300).optional().default(''),
  verified: z.literal(true, { error: 'Confirm that you verified this metric' }),
})
export type ReportMetric = z.infer<typeof metricSchema>
