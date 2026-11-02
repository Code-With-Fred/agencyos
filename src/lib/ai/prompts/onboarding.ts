import { ONBOARDING_DOC_TYPES, type OnboardingDocType } from '../schemas/onboarding.schema'
import { dataBlock } from './shared'

export const ONBOARDING_SYSTEM = `You are an agency operations lead preparing client onboarding documents.
Documents must be specific to the project type and requirements, practical and ready to send after review.
Use "[placeholder]" for details you do not have (dates, names, links). Never invent facts about the client or agency.`

const GUIDE: Record<OnboardingDocType, string> = {
  welcome_email: 'A warm, concise welcome email (subject + body) explaining what happens next and what we need from the client. Sign off with the agency name.',
  questionnaire: 'A discovery questionnaire grouped into sections with numbered questions specific to the project type.',
  requirements_doc: 'A project requirements document: objectives, scope, functional/non-functional requirements, assumptions, open questions.',
  checklist: 'Onboarding checklist: return items as short actionable checklist lines; content is a brief intro.',
  asset_list: 'Assets the client must provide (logins, brand files, content, analytics access…): return as items; content explains how to share them securely.',
  kickoff_agenda: 'A 45–60 minute kickoff meeting agenda with timings, owners and expected outcomes.',
  communication_guidelines: 'Communication guidelines: channels, response times, meeting cadence, approvals and escalation.',
}

export function buildOnboardingPrompt(input: { agencyName: string; clientName: string; clientCompany: string | null; projectType: string; requirements: string; types: OnboardingDocType[] }) {
  const wanted = ONBOARDING_DOC_TYPES.filter((d) => input.types.includes(d.type))
  return `Create these onboarding documents: ${wanted.map((d) => d.type).join(', ')}.

${dataBlock('engagement', { agency: input.agencyName, client: input.clientName, client_company: input.clientCompany, project_type: input.projectType, requirements: input.requirements })}

Document guidance:
${wanted.map((d) => `- ${d.type} ("${d.title}"): ${GUIDE[d.type]}`).join('\n')}

Return exactly one document per requested type.`
}
