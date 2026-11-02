import { z } from 'zod'
import { currency, optionalDate, optionalMoney, optionalText, optionalUuid, requiredText } from './common'
import { PROPOSAL_SECTION_KEYS } from '@/lib/ai/schemas/proposal.schema'
import { ONBOARDING_TYPE_KEYS } from '@/lib/ai/schemas/onboarding.schema'
import { metricSchema } from '@/lib/ai/schemas/report.schema'

export const proposalBriefSchema = z.object({
  clientId: optionalUuid,
  clientName: requiredText(160, 'Client name'),
  clientCompany: optionalText(160),
  projectTitle: requiredText(200, 'Project title'),
  projectDescription: requiredText(5000, 'Project description'),
  requirements: optionalText(5000),
  services: optionalText(3000),
  deliverables: optionalText(3000),
  budget: optionalMoney,
  currency,
  timeline: optionalText(500),
  paymentTerms: optionalText(1000),
  notes: optionalText(3000),
  template: z.enum(['consulting', 'modern', 'minimal']).default('consulting'),
  mode: z.enum(['ai', 'blank']).default('ai'),
})
export type ProposalBriefInput = z.infer<typeof proposalBriefSchema>

export const proposalMetaSchema = z.object({
  title: requiredText(200, 'Title'),
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'archived']),
  template: z.enum(['consulting', 'modern', 'minimal']),
  clientId: optionalUuid,
  validUntil: optionalDate,
  currency,
})

export const sectionKeySchema = z.enum(PROPOSAL_SECTION_KEYS)
export const sectionContentSchema = z.string().max(30000, 'Section is too long')

export const pricingItemsSchema = z
  .array(
    z.object({
      item: z.string().trim().min(1, 'Item name is required').max(160),
      description: z.string().trim().max(400).default(''),
      amount: z.number().min(0).max(1e10).nullable(),
    }),
  )
  .max(30)

export const reportCreateSchema = z.object({
  clientId: optionalUuid,
  title: requiredText(200, 'Report title'),
  template: z.enum(['executive', 'detailed']).default('executive'),
  periodStart: optionalDate,
  periodEnd: optionalDate,
  auditId: optionalUuid,
})

export const reportSectionUpdateSchema = z.object({
  title: requiredText(160, 'Section title'),
  content: z.string().max(30000),
  enabled: z.boolean(),
})

export const metricsSchema = z.array(metricSchema).max(40)

export const shareSchema = z.object({ expiresInDays: z.union([z.literal(0), z.literal(7), z.literal(30), z.literal(90)]) })

export const onboardingCreateSchema = z.object({
  clientId: z.uuid('Select a client'),
  projectId: optionalUuid,
  projectType: requiredText(60, 'Project type'),
  requirements: z.string().trim().max(10000).default(''),
  types: z.array(z.enum(ONBOARDING_TYPE_KEYS)).min(1, 'Select at least one document'),
})

export const onboardingDocUpdateSchema = z.object({
  title: requiredText(200, 'Title'),
  subject: optionalText(300),
  content: z.string().max(30000),
  status: z.enum(['draft', 'ready', 'sent', 'completed']),
})
