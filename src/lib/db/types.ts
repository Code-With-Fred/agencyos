import type { ColumnType, Generated } from 'kysely'

/** timestamptz: returned as Date; accepts Date or ISO string on write. */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>
/** date: parsed to 'YYYY-MM-DD' strings (see pool.ts type parsers). */
type DateString = ColumnType<string | null, string | null | undefined, string | null>
/**
 * jsonb: always pass JSON.stringify(...) on write. node-postgres serializes JS
 * arrays as Postgres arrays, which would corrupt jsonb columns.
 */
type Json<T> = ColumnType<T, string, string>
type JsonWithDefault<T> = ColumnType<T, string | undefined, string>

export type Role = 'owner' | 'admin' | 'member'

export interface UserTable {
  id: string
  name: string
  email: string
  emailVerified: Generated<boolean>
  image: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SessionTable {
  id: string
  expiresAt: Timestamp
  token: string
  createdAt: Timestamp
  updatedAt: Timestamp
  ipAddress: string | null
  userAgent: string | null
  userId: string
}

export interface PlatformAdminsTable {
  user_id: string
  created_at: Timestamp
}

export interface OrganizationsTable {
  id: Generated<string>
  name: string
  website: string | null
  industry: string | null
  country: string | null
  business_email: string | null
  brand_color: Generated<string>
  logo_path: string | null
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface OrganizationMembersTable {
  id: Generated<string>
  organization_id: string
  user_id: string
  role: Role
  created_at: Timestamp
  updated_at: Timestamp
}

export interface InvitationsTable {
  id: Generated<string>
  organization_id: string
  email: string
  role: 'admin' | 'member'
  token_hash: string
  invited_by: string | null
  expires_at: Timestamp
  accepted_at: NullableTimestamp
  accepted_by: string | null
  revoked_at: NullableTimestamp
  created_at: Timestamp
}

export type ClientStatus = 'lead' | 'active' | 'paused' | 'archived'
export interface ClientsTable {
  id: Generated<string>
  organization_id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  industry: string | null
  country: string | null
  notes: string | null
  status: Generated<ClientStatus>
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type ProjectStatus = 'planning' | 'in_progress' | 'review' | 'completed' | 'on_hold'
export interface ProjectsTable {
  id: Generated<string>
  organization_id: string
  client_id: string | null
  name: string
  description: string | null
  status: Generated<ProjectStatus>
  deadline: DateString
  budget: number | null
  currency: Generated<string>
  internal_notes: string | null
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ProjectMembersTable {
  project_id: string
  organization_id: string
  user_id: string
  created_at: Timestamp
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export interface ProjectTasksTable {
  id: Generated<string>
  organization_id: string
  project_id: string
  title: string
  description: string | null
  status: Generated<TaskStatus>
  assignee_id: string | null
  due_date: DateString
  position: Generated<number>
  completed_at: NullableTimestamp
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface WebsiteAuditsTable {
  id: Generated<string>
  organization_id: string
  client_id: string | null
  url: string
  final_url: string | null
  status: Generated<'running' | 'completed' | 'failed'>
  overall_score: number | null
  category_scores: Json<unknown> | null
  findings: Json<unknown> | null
  issues: Json<unknown> | null
  pagespeed: Json<unknown> | null
  ai_analysis: Json<unknown> | null
  ai_status: Generated<'pending' | 'completed' | 'failed' | 'skipped'>
  ai_error: string | null
  error: string | null
  rules_version: string
  prompt_version: string | null
  created_by: string | null
  started_at: Timestamp
  completed_at: NullableTimestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export type ProposalTemplate = 'consulting' | 'modern' | 'minimal'
export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'archived'
export interface ProposalsTable {
  id: Generated<string>
  organization_id: string
  client_id: string | null
  title: string
  template: Generated<ProposalTemplate>
  status: Generated<ProposalStatus>
  brief: Json<unknown>
  pricing_items: JsonWithDefault<unknown>
  currency: Generated<string>
  total_amount: number | null
  valid_until: DateString
  prompt_version: string | null
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ProposalSectionsTable {
  id: Generated<string>
  organization_id: string
  proposal_id: string
  key: string
  title: string
  content: Generated<string>
  position: Generated<number>
  ai_generated: Generated<boolean>
  created_at: Timestamp
  updated_at: Timestamp
}

export type ReportTemplate = 'executive' | 'detailed'
export interface ReportsTable {
  id: Generated<string>
  organization_id: string
  client_id: string | null
  audit_id: string | null
  title: string
  template: Generated<ReportTemplate>
  status: Generated<'draft' | 'final'>
  period_start: DateString
  period_end: DateString
  metrics: JsonWithDefault<unknown>
  prompt_version: string | null
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type ReportSectionKind = 'summary' | 'audit' | 'projects' | 'metrics' | 'updates' | 'next_steps' | 'custom'
export interface ReportSectionsTable {
  id: Generated<string>
  organization_id: string
  report_id: string
  kind: ReportSectionKind
  title: string
  content: Generated<string>
  position: Generated<number>
  enabled: Generated<boolean>
  ai_generated: Generated<boolean>
  created_at: Timestamp
  updated_at: Timestamp
}

export interface SharedReportsTable {
  id: Generated<string>
  organization_id: string
  report_id: string
  token_hash: string
  expires_at: NullableTimestamp
  revoked_at: NullableTimestamp
  view_count: Generated<number>
  last_viewed_at: NullableTimestamp
  created_by: string | null
  created_at: Timestamp
}

export interface OnboardingKitsTable {
  id: Generated<string>
  organization_id: string
  client_id: string | null
  project_id: string | null
  title: string
  project_type: string
  requirements: Generated<string>
  prompt_version: string | null
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type OnboardingDocType =
  | 'welcome_email'
  | 'questionnaire'
  | 'requirements_doc'
  | 'checklist'
  | 'asset_list'
  | 'kickoff_agenda'
  | 'communication_guidelines'
export type OnboardingDocStatus = 'draft' | 'ready' | 'sent' | 'completed'
export interface OnboardingDocumentsTable {
  id: Generated<string>
  organization_id: string
  kit_id: string
  doc_type: OnboardingDocType
  title: string
  subject: string | null
  content: Generated<string>
  items: JsonWithDefault<unknown>
  status: Generated<OnboardingDocStatus>
  sent_at: NullableTimestamp
  position: Generated<number>
  created_by: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface BrandingSettingsTable {
  organization_id: string
  company_name: string | null
  accent_color: Generated<string>
  contact_email: string | null
  contact_phone: string | null
  contact_website: string | null
  address: string | null
  report_footer: string | null
  report_title_default: string | null
  white_label_enabled: Generated<boolean>
  updated_at: Timestamp
}

export interface ActivityLogsTable {
  id: Generated<string>
  organization_id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: string
  metadata: JsonWithDefault<unknown>
  created_at: Timestamp
}

export type AiFeature = 'audit' | 'proposal' | 'proposal_section' | 'report' | 'onboarding'
export interface AiUsageLogsTable {
  id: Generated<string>
  organization_id: string
  user_id: string | null
  feature: AiFeature
  model: string
  prompt_version: string
  status: 'success' | 'error'
  error_code: string | null
  input_tokens: Generated<number>
  output_tokens: Generated<number>
  total_tokens: Generated<number>
  latency_ms: Generated<number>
  attempts: Generated<number>
  created_at: Timestamp
}

export type LicensePlan = 'standard' | 'agency' | 'enterprise'
export type LicenseStatus = 'active' | 'suspended' | 'revoked'
export interface LicenseKeysTable {
  id: Generated<string>
  key_hash: string
  key_encrypted: string
  key_last4: string
  plan: LicensePlan
  status: Generated<LicenseStatus>
  source: 'stripe' | 'manual'
  max_activations: Generated<number>
  expires_at: NullableTimestamp
  customer_email: string
  customer_name: string | null
  notes: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  amount_total: number | null
  currency: string | null
  created_by: string | null
  revoked_at: NullableTimestamp
  revoked_reason: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface LicenseActivationsTable {
  id: Generated<string>
  license_key_id: string
  organization_id: string
  activated_by: string | null
  activated_at: Timestamp
  deactivated_at: NullableTimestamp
  deactivated_reason: string | null
}

export interface StripeEventsTable {
  id: string
  type: string
  received_at: Timestamp
  processed_at: NullableTimestamp
}

export interface RateLimitsTable {
  key: string
  window_start: Timestamp
  count: Generated<number>
}

export interface ContactSubmissionsTable {
  id: Generated<string>
  name: string
  email: string
  company: string | null
  topic: 'sales' | 'support' | 'partnership' | 'self_hosted' | 'other'
  message: string
  created_at: Timestamp
}

export interface Database {
  user: UserTable
  session: SessionTable
  platform_admins: PlatformAdminsTable
  organizations: OrganizationsTable
  organization_members: OrganizationMembersTable
  invitations: InvitationsTable
  clients: ClientsTable
  projects: ProjectsTable
  project_members: ProjectMembersTable
  project_tasks: ProjectTasksTable
  website_audits: WebsiteAuditsTable
  proposals: ProposalsTable
  proposal_sections: ProposalSectionsTable
  reports: ReportsTable
  report_sections: ReportSectionsTable
  shared_reports: SharedReportsTable
  onboarding_kits: OnboardingKitsTable
  onboarding_documents: OnboardingDocumentsTable
  branding_settings: BrandingSettingsTable
  activity_logs: ActivityLogsTable
  ai_usage_logs: AiUsageLogsTable
  license_keys: LicenseKeysTable
  license_activations: LicenseActivationsTable
  stripe_events: StripeEventsTable
  rate_limits: RateLimitsTable
  contact_submissions: ContactSubmissionsTable
}
