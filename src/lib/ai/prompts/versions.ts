/** Bump a version whenever its prompt or schema changes; it is stored with every generation. */
export const PROMPT_VERSIONS = {
  audit: 'audit-v1.2',
  proposal: 'proposal-v1.1',
  proposal_section: 'proposal-section-v1.1',
  report: 'report-v1.1',
  onboarding: 'onboarding-v1.1',
} as const
