import { z } from 'zod'

export const ONBOARDING_DOC_TYPES = [
  { type: 'welcome_email', title: 'Welcome Email', checklist: false },
  { type: 'questionnaire', title: 'Client Questionnaire', checklist: false },
  { type: 'requirements_doc', title: 'Project Requirements Document', checklist: false },
  { type: 'checklist', title: 'Onboarding Checklist', checklist: true },
  { type: 'asset_list', title: 'Required Assets', checklist: true },
  { type: 'kickoff_agenda', title: 'Kickoff Meeting Agenda', checklist: false },
  { type: 'communication_guidelines', title: 'Communication Guidelines', checklist: false },
] as const
export type OnboardingDocType = (typeof ONBOARDING_DOC_TYPES)[number]['type']
export const ONBOARDING_TYPE_KEYS = ONBOARDING_DOC_TYPES.map((d) => d.type) as [OnboardingDocType, ...OnboardingDocType[]]

export const onboardingAiSchema = z.object({
  documents: z
    .array(
      z.object({
        type: z.enum(ONBOARDING_TYPE_KEYS),
        title: z.string().min(1).max(200),
        subject: z.string().max(300).optional().describe('Email subject line; only for welcome_email'),
        content: z.string().min(1).max(12000),
        items: z.array(z.string().min(1).max(300)).max(40).optional().describe('Checklist items; only for checklist and asset_list'),
      }),
    )
    .min(1)
    .max(7),
})
export type OnboardingAi = z.infer<typeof onboardingAiSchema>

export type ChecklistItem = { id: string; label: string; done: boolean }
