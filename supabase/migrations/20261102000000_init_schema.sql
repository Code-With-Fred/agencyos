-- =============================================================================
-- AgencyOS AI — initial schema
-- -----------------------------------------------------------------------------
-- Authentication tables follow the Better Auth core schema (camelCase columns).
-- Every tenant-owned table carries organization_id and is protected by RLS in
-- the next migration (20261102000100_rls.sql).
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists app;

-- -----------------------------------------------------------------------------
-- Utility: updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Better Auth core tables
-- -----------------------------------------------------------------------------
create table if not exists "user" (
  "id"            text primary key,
  "name"          text not null,
  "email"         text not null unique,
  "emailVerified" boolean not null default false,
  "image"         text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);

create table if not exists "session" (
  "id"        text primary key,
  "expiresAt" timestamptz not null,
  "token"     text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId"    text not null references "user"("id") on delete cascade
);
create index if not exists session_user_id_idx on "session"("userId");

create table if not exists "account" (
  "id"                    text primary key,
  "accountId"             text not null,
  "providerId"            text not null,
  "userId"                text not null references "user"("id") on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope"                 text,
  "password"              text,
  "createdAt"             timestamptz not null default now(),
  "updatedAt"             timestamptz not null default now()
);
create index if not exists account_user_id_idx on "account"("userId");

create table if not exists "verification" (
  "id"         text primary key,
  "identifier" text not null,
  "value"      text not null,
  "expiresAt"  timestamptz not null,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);
create index if not exists verification_identifier_idx on "verification"("identifier");

create table if not exists "rateLimit" (
  "id"          text primary key,
  "key"         text not null unique,
  "count"       integer not null,
  "lastRequest" bigint not null
);

-- -----------------------------------------------------------------------------
-- Platform administration (vendor-level; not tenant data)
-- Rows are inserted manually by the operator via SQL — never by the app.
-- -----------------------------------------------------------------------------
create table if not exists platform_admins (
  user_id    text primary key references "user"("id") on delete cascade,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Organizations & membership
-- -----------------------------------------------------------------------------
create table if not exists organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 2 and 120),
  website        text check (website is null or char_length(website) <= 2048),
  industry       text check (industry is null or char_length(industry) <= 120),
  country        text check (country is null or char_length(country) <= 80),
  business_email text check (business_email is null or char_length(business_email) <= 320),
  brand_color    text not null default '#6366F1' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path      text,
  created_by     text references "user"("id") on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger organizations_updated_at before update on organizations
  for each row execute function app.set_updated_at();

create table if not exists organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         text not null references "user"("id") on delete cascade,
  role            text not null check (role in ('owner', 'admin', 'member')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists organization_members_user_idx on organization_members(user_id);
create trigger organization_members_updated_at before update on organization_members
  for each row execute function app.set_updated_at();

create table if not exists invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           text not null check (email = lower(email) and char_length(email) <= 320),
  role            text not null check (role in ('admin', 'member')),
  token_hash      text not null unique,
  invited_by      text references "user"("id") on delete set null,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  accepted_by     text references "user"("id") on delete set null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists invitations_org_idx on invitations(organization_id, created_at desc);
-- Only one open invitation per email per organization.
create unique index if not exists invitations_open_unique
  on invitations(organization_id, email) where accepted_at is null and revoked_at is null;

-- -----------------------------------------------------------------------------
-- Clients
-- -----------------------------------------------------------------------------
create table if not exists clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 160),
  company         text check (company is null or char_length(company) <= 160),
  email           text check (email is null or char_length(email) <= 320),
  phone           text check (phone is null or char_length(phone) <= 40),
  website         text check (website is null or char_length(website) <= 2048),
  industry        text check (industry is null or char_length(industry) <= 120),
  country         text check (country is null or char_length(country) <= 80),
  notes           text check (notes is null or char_length(notes) <= 10000),
  status          text not null default 'active' check (status in ('lead', 'active', 'paused', 'archived')),
  created_by      text references "user"("id") on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id)
);
create index if not exists clients_org_created_idx on clients(organization_id, created_at desc);
create index if not exists clients_org_status_idx on clients(organization_id, status);
create index if not exists clients_org_name_idx on clients(organization_id, lower(name));
create trigger clients_updated_at before update on clients
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id       uuid,
  name            text not null check (char_length(name) between 1 and 160),
  description     text check (description is null or char_length(description) <= 10000),
  status          text not null default 'planning'
                  check (status in ('planning', 'in_progress', 'review', 'completed', 'on_hold')),
  deadline        date,
  budget          numeric(14, 2) check (budget is null or budget >= 0),
  currency        text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  internal_notes  text check (internal_notes is null or char_length(internal_notes) <= 20000),
  created_by      text references "user"("id") on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  -- Composite FK guarantees the client belongs to the same organization.
  foreign key (client_id, organization_id) references clients(id, organization_id) on delete set null (client_id)
);
create index if not exists projects_org_created_idx on projects(organization_id, created_at desc);
create index if not exists projects_org_status_idx on projects(organization_id, status);
create index if not exists projects_client_idx on projects(client_id);
create trigger projects_updated_at before update on projects
  for each row execute function app.set_updated_at();

create table if not exists project_members (
  project_id      uuid not null,
  organization_id uuid not null,
  user_id         text not null references "user"("id") on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (project_id, organization_id) references projects(id, organization_id) on delete cascade
);
create index if not exists project_members_user_idx on project_members(user_id, organization_id);

create table if not exists project_tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id      uuid not null,
  title           text not null check (char_length(title) between 1 and 300),
  description     text check (description is null or char_length(description) <= 5000),
  status          text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  assignee_id     text references "user"("id") on delete set null,
  due_date        date,
  position        integer not null default 0,
  completed_at    timestamptz,
  created_by      text references "user"("id") on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (project_id, organization_id) references projects(id, organization_id) on delete cascade
);
create index if not exists project_tasks_project_idx on project_tasks(project_id, position);
create index if not exists project_tasks_org_idx on project_tasks(organization_id);
create trigger project_tasks_updated_at before update on project_tasks
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Website audits
-- -----------------------------------------------------------------------------
create table if not exists website_audits (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id       uuid,
  url             text not null check (char_length(url) <= 2048),
  final_url       text check (final_url is null or char_length(final_url) <= 2048),
  status          text not null default 'running' check (status in ('running', 'completed', 'failed')),
  overall_score   integer check (overall_score between 0 and 100),
  category_scores jsonb,
  findings        jsonb,
  issues          jsonb,
  pagespeed       jsonb,
  ai_analysis     jsonb,
  ai_status       text not null default 'pending' check (ai_status in ('pending', 'completed', 'failed', 'skipped')),
  ai_error        text,
  error           text,
  rules_version   text not null,
  prompt_version  text,
  created_by      text references "user"("id") on delete set null,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (client_id, organization_id) references clients(id, organization_id) on delete set null (client_id)
);
create index if not exists website_audits_org_created_idx on website_audits(organization_id, created_at desc);
create index if not exists website_audits_client_idx on website_audits(client_id);
create trigger website_audits_updated_at before update on website_audits
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Proposals
-- -----------------------------------------------------------------------------
create table if not exists proposals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id       uuid,
  title           text not null check (char_length(title) between 1 and 200),
  template        text not null default 'consulting' check (template in ('consulting', 'modern', 'minimal')),
  status          text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'archived')),
  brief           jsonb not null,
  pricing_items   jsonb not null default '[]'::jsonb,
  currency        text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  total_amount    numeric(14, 2),
  valid_until     date,
  prompt_version  text,
  created_by      text references "user"("id") on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (client_id, organization_id) references clients(id, organization_id) on delete set null (client_id)
);
create index if not exists proposals_org_created_idx on proposals(organization_id, created_at desc);
create index if not exists proposals_client_idx on proposals(client_id);
create trigger proposals_updated_at before update on proposals
  for each row execute function app.set_updated_at();

create table if not exists proposal_sections (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  proposal_id     uuid not null,
  key             text not null check (key ~ '^[a-z_]{2,40}$'),
  title           text not null check (char_length(title) between 1 and 160),
  content         text not null default '' check (char_length(content) <= 30000),
  position        integer not null default 0,
  ai_generated    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (proposal_id, key),
  foreign key (proposal_id, organization_id) references proposals(id, organization_id) on delete cascade
);
create index if not exists proposal_sections_proposal_idx on proposal_sections(proposal_id, position);
create trigger proposal_sections_updated_at before update on proposal_sections
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Reports
-- -----------------------------------------------------------------------------
create table if not exists reports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id       uuid,
  audit_id        uuid,
  title           text not null check (char_length(title) between 1 and 200),
  template        text not null default 'executive' check (template in ('executive', 'detailed')),
  status          text not null default 'draft' check (status in ('draft', 'final')),
  period_start    date,
  period_end      date,
  metrics         jsonb not null default '[]'::jsonb,
  prompt_version  text,
  created_by      text references "user"("id") on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  check (period_start is null or period_end is null or period_start <= period_end),
  foreign key (client_id, organization_id) references clients(id, organization_id) on delete set null (client_id),
  foreign key (audit_id, organization_id) references website_audits(id, organization_id) on delete set null (audit_id)
);
create index if not exists reports_org_created_idx on reports(organization_id, created_at desc);
create index if not exists reports_client_idx on reports(client_id);
create trigger reports_updated_at before update on reports
  for each row execute function app.set_updated_at();

create table if not exists report_sections (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  report_id       uuid not null,
  kind            text not null check (kind in ('summary', 'audit', 'projects', 'metrics', 'updates', 'next_steps', 'custom')),
  title           text not null check (char_length(title) between 1 and 160),
  content         text not null default '' check (char_length(content) <= 30000),
  position        integer not null default 0,
  enabled         boolean not null default true,
  ai_generated    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (report_id, organization_id) references reports(id, organization_id) on delete cascade
);
create index if not exists report_sections_report_idx on report_sections(report_id, position);
create trigger report_sections_updated_at before update on report_sections
  for each row execute function app.set_updated_at();

create table if not exists shared_reports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  report_id       uuid not null,
  token_hash      text not null unique,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  view_count      integer not null default 0,
  last_viewed_at  timestamptz,
  created_by      text references "user"("id") on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (report_id, organization_id) references reports(id, organization_id) on delete cascade
);
create index if not exists shared_reports_report_idx on shared_reports(report_id);

-- -----------------------------------------------------------------------------
-- Onboarding
-- -----------------------------------------------------------------------------
create table if not exists onboarding_kits (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id       uuid,
  project_id      uuid,
  title           text not null check (char_length(title) between 1 and 200),
  project_type    text not null check (char_length(project_type) between 2 and 60),
  requirements    text not null default '' check (char_length(requirements) <= 10000),
  prompt_version  text,
  created_by      text references "user"("id") on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (client_id, organization_id) references clients(id, organization_id) on delete set null (client_id),
  foreign key (project_id, organization_id) references projects(id, organization_id) on delete set null (project_id)
);
create index if not exists onboarding_kits_org_idx on onboarding_kits(organization_id, created_at desc);
create index if not exists onboarding_kits_client_idx on onboarding_kits(client_id);
create trigger onboarding_kits_updated_at before update on onboarding_kits
  for each row execute function app.set_updated_at();

create table if not exists onboarding_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  kit_id          uuid not null,
  doc_type        text not null check (doc_type in (
                    'welcome_email', 'questionnaire', 'requirements_doc', 'checklist',
                    'asset_list', 'kickoff_agenda', 'communication_guidelines')),
  title           text not null check (char_length(title) between 1 and 200),
  subject         text check (subject is null or char_length(subject) <= 300),
  content         text not null default '' check (char_length(content) <= 30000),
  items           jsonb not null default '[]'::jsonb,
  status          text not null default 'draft' check (status in ('draft', 'ready', 'sent', 'completed')),
  sent_at         timestamptz,
  position        integer not null default 0,
  created_by      text references "user"("id") on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (kit_id, doc_type),
  foreign key (kit_id, organization_id) references onboarding_kits(id, organization_id) on delete cascade
);
create index if not exists onboarding_documents_kit_idx on onboarding_documents(kit_id, position);
create trigger onboarding_documents_updated_at before update on onboarding_documents
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Branding (white-label settings)
-- -----------------------------------------------------------------------------
create table if not exists branding_settings (
  organization_id      uuid primary key references organizations(id) on delete cascade,
  company_name         text check (company_name is null or char_length(company_name) <= 160),
  accent_color         text not null default '#0EA5E9' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  contact_email        text check (contact_email is null or char_length(contact_email) <= 320),
  contact_phone        text check (contact_phone is null or char_length(contact_phone) <= 40),
  contact_website      text check (contact_website is null or char_length(contact_website) <= 2048),
  address              text check (address is null or char_length(address) <= 500),
  report_footer        text check (report_footer is null or char_length(report_footer) <= 500),
  report_title_default text check (report_title_default is null or char_length(report_title_default) <= 200),
  white_label_enabled  boolean not null default false,
  updated_at           timestamptz not null default now()
);
create trigger branding_settings_updated_at before update on branding_settings
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Activity & AI usage
-- -----------------------------------------------------------------------------
create table if not exists activity_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id        text references "user"("id") on delete set null,
  action          text not null check (char_length(action) <= 80),
  entity_type     text not null check (char_length(entity_type) <= 40),
  entity_id       uuid,
  summary         text not null check (char_length(summary) <= 500),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists activity_logs_org_created_idx on activity_logs(organization_id, created_at desc);

create table if not exists ai_usage_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         text references "user"("id") on delete set null,
  feature         text not null check (feature in ('audit', 'proposal', 'proposal_section', 'report', 'onboarding')),
  model           text not null,
  prompt_version  text not null,
  status          text not null check (status in ('success', 'error')),
  error_code      text,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  total_tokens    integer not null default 0,
  latency_ms      integer not null default 0,
  attempts        integer not null default 1,
  created_at      timestamptz not null default now()
);
create index if not exists ai_usage_logs_org_created_idx on ai_usage_logs(organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Licensing & payments (platform-level; accessed only through system context)
-- -----------------------------------------------------------------------------
create table if not exists license_keys (
  id                         uuid primary key default gen_random_uuid(),
  key_hash                   text not null unique,
  key_encrypted              text not null,
  key_last4                  text not null check (char_length(key_last4) = 4),
  plan                       text not null check (plan in ('standard', 'agency', 'enterprise')),
  status                     text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  source                     text not null check (source in ('stripe', 'manual')),
  max_activations            integer not null default 1 check (max_activations between 1 and 100),
  expires_at                 timestamptz,
  customer_email             text not null check (char_length(customer_email) <= 320),
  customer_name              text check (customer_name is null or char_length(customer_name) <= 200),
  notes                      text check (notes is null or char_length(notes) <= 2000),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,
  amount_total               integer,
  currency                   text,
  created_by                 text references "user"("id") on delete set null,
  revoked_at                 timestamptz,
  revoked_reason             text check (revoked_reason is null or char_length(revoked_reason) <= 500),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists license_keys_email_idx on license_keys(lower(customer_email));
create trigger license_keys_updated_at before update on license_keys
  for each row execute function app.set_updated_at();

create table if not exists license_activations (
  id               uuid primary key default gen_random_uuid(),
  license_key_id   uuid not null references license_keys(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  activated_by     text references "user"("id") on delete set null,
  activated_at     timestamptz not null default now(),
  deactivated_at   timestamptz,
  deactivated_reason text
);
create index if not exists license_activations_key_idx on license_activations(license_key_id);
-- An organization has at most one active license at a time.
create unique index if not exists license_activations_one_active_per_org
  on license_activations(organization_id) where deactivated_at is null;

create table if not exists stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- -----------------------------------------------------------------------------
-- Operational tables
-- -----------------------------------------------------------------------------
create table if not exists rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);
create index if not exists rate_limits_window_idx on rate_limits(window_start);

create table if not exists contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 160),
  email      text not null check (char_length(email) <= 320),
  company    text check (company is null or char_length(company) <= 160),
  topic      text not null check (topic in ('sales', 'support', 'partnership', 'self_hosted', 'other')),
  message    text not null check (char_length(message) between 10 and 5000),
  created_at timestamptz not null default now()
);
