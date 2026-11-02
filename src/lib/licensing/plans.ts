import type { LicensePlan } from '@/lib/db/types'

export type Module = 'clients' | 'projects' | 'audits' | 'proposals' | 'reports' | 'onboarding'
export type PlanId = LicensePlan | 'evaluation'

export type PlanDefinition = {
  id: PlanId
  name: string
  tagline: string
  /** Display price in USD; Stripe Price objects must match (see docs/licensing.md). */
  priceUsd: number | null
  modules: Module[]
  maxMembers: number
  aiGenerationsPerMonth: number
  auditsPerMonth: number
  whiteLabel: boolean
  purchasable: boolean
  highlights: string[]
}

const ALL_MODULES: Module[] = ['clients', 'projects', 'audits', 'proposals', 'reports', 'onboarding']

export const PLANS: Record<PlanId, PlanDefinition> = {
  evaluation: {
    id: 'evaluation',
    name: 'Evaluation',
    tagline: 'Explore every module before activating a license.',
    priceUsd: 0,
    modules: ALL_MODULES,
    maxMembers: 2,
    aiGenerationsPerMonth: 10,
    auditsPerMonth: 5,
    whiteLabel: false,
    purchasable: false,
    highlights: ['All modules with low monthly limits', 'Deliverables carry an AgencyOS footer', 'Up to 2 team members'],
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    tagline: 'Core operations for independent consultants and small teams.',
    priceUsd: 490,
    modules: ['clients', 'projects', 'audits', 'proposals'],
    maxMembers: 3,
    aiGenerationsPerMonth: 300,
    auditsPerMonth: 150,
    whiteLabel: false,
    purchasable: true,
    highlights: ['One organization', 'Clients, projects, website audits and proposals', 'Up to 3 team members', 'Branded PDF exports'],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    tagline: 'The complete toolkit with white-label client deliverables.',
    priceUsd: 1490,
    modules: ALL_MODULES,
    maxMembers: 15,
    aiGenerationsPerMonth: 1500,
    auditsPerMonth: 750,
    whiteLabel: true,
    purchasable: true,
    highlights: ['One organization', 'All four AI modules incl. reporting and onboarding', 'White-label reports and share links', 'Up to 15 team members'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Negotiated terms, advanced customization and integrations.',
    priceUsd: null,
    modules: ALL_MODULES,
    maxMembers: 200,
    aiGenerationsPerMonth: 10000,
    auditsPerMonth: 5000,
    whiteLabel: true,
    purchasable: false,
    highlights: ['Advanced customization', 'Additional integrations', 'Priority support', 'Optional self-hosted deployment (negotiated separately)'],
  },
}

export const MODULE_LABELS: Record<Module, string> = {
  clients: 'Client management',
  projects: 'Project management',
  audits: 'AI website audits',
  proposals: 'AI proposals',
  reports: 'White-label reporting',
  onboarding: 'AI client onboarding',
}

export function isPurchasablePlan(plan: string): plan is 'standard' | 'agency' {
  return plan === 'standard' || plan === 'agency'
}
