-- =============================================================================
-- AgencyOS AI — Row Level Security & tenant isolation
-- -----------------------------------------------------------------------------
-- Model:
--   * The application connects as the dedicated role `agencyos_app`
--     (NOBYPASSRLS, not a table owner), so every policy below applies to it.
--   * Each request runs in a transaction that sets
--       set_config('app.user_id', <verified session user id>, true)
--     The user id always comes from a server-verified Better Auth session,
--     never from the browser.
--   * Policies derive organization access from organization_members, so a
--     query that forgets a WHERE organization_id = ... still cannot read or
--     write another tenant's rows.
--   * A narrow "system" context (app.system = 'on') is used only by specific
--     server modules (Stripe webhook, license administration, token-based
--     public share lookup, invitation lookup, rate limiting). It is never
--     derived from request input.
--   * Supabase's PostgREST roles (anon, authenticated) get no grants and no
--     policies: the publishable key cannot read any table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Application role
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agencyos_app') then
    create role agencyos_app nologin nobypassrls;
  end if;
end
$$;
-- The operator enables login and sets a password out-of-band:
--   alter role agencyos_app with login password '<generated secret>';

grant usage on schema public to agencyos_app;
grant usage on schema app to agencyos_app;
grant select, insert, update, delete on all tables in schema public to agencyos_app;

-- Lock out Supabase API roles entirely (defence in depth on top of RLS).
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all functions in schema app from %I', r);
      execute format('revoke usage on schema app from %I', r);
    end if;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Context helpers
-- -----------------------------------------------------------------------------
create or replace function app.current_user_id() returns text
language sql stable
as $$ select nullif(current_setting('app.user_id', true), '') $$;

create or replace function app.is_system() returns boolean
language sql stable
as $$ select coalesce(current_setting('app.system', true), '') = 'on' $$;

-- SECURITY DEFINER so membership lookups do not recurse through RLS.
create or replace function app.member_role(org uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select m.role from public.organization_members m
  where m.organization_id = org and m.user_id = app.current_user_id()
$$;

create or replace function app.is_member(org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select app.member_role(org) is not null $$;

create or replace function app.is_admin(org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(app.member_role(org) in ('owner', 'admin'), false) $$;

create or replace function app.is_owner(org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(app.member_role(org) = 'owner', false) $$;

-- Owners/admins see every project; members see projects they are assigned to.
create or replace function app.can_access_project(p_project uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_admin(p_org) or (
    app.is_member(p_org) and exists (
      select 1 from public.project_members pm
      where pm.project_id = p_project and pm.organization_id = p_org
        and pm.user_id = app.current_user_id()
    )
  )
$$;

-- Content owned by a creator (proposals, reports, onboarding kits):
-- admins can edit everything, members only what they created.
create or replace function app.can_edit_owned(p_org uuid, p_created_by text) returns boolean
language sql stable security definer set search_path = ''
as $$ select app.is_admin(p_org) or (app.is_member(p_org) and p_created_by = app.current_user_id()) $$;

grant execute on all functions in schema app to agencyos_app;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'user', 'session', 'account', 'verification', 'rateLimit', 'platform_admins',
    'organizations', 'organization_members', 'invitations', 'clients', 'projects',
    'project_members', 'project_tasks', 'website_audits', 'proposals', 'proposal_sections',
    'reports', 'report_sections', 'shared_reports', 'onboarding_kits', 'onboarding_documents',
    'branding_settings', 'activity_logs', 'ai_usage_logs', 'license_keys',
    'license_activations', 'stripe_events', 'rate_limits', 'contact_submissions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Authentication tables: managed by Better Auth through the app role.
-- No tenant data lives here; PostgREST roles have no access.
-- -----------------------------------------------------------------------------
create policy auth_user_app on "user" for all to agencyos_app using (true) with check (true);
create policy auth_session_app on "session" for all to agencyos_app using (true) with check (true);
create policy auth_account_app on "account" for all to agencyos_app using (true) with check (true);
create policy auth_verification_app on "verification" for all to agencyos_app using (true) with check (true);
create policy auth_rate_limit_app on "rateLimit" for all to agencyos_app using (true) with check (true);
create policy rate_limits_app on rate_limits for all to agencyos_app using (true) with check (true);

-- Platform admins: users can only see their own row; writes are SQL-only.
create policy platform_admins_select on platform_admins for select to agencyos_app
  using (app.is_system() or user_id = app.current_user_id());

-- -----------------------------------------------------------------------------
-- Organizations & membership
-- -----------------------------------------------------------------------------
create policy organizations_select on organizations for select to agencyos_app
  using (app.is_system() or app.is_member(id));
create policy organizations_update on organizations for update to agencyos_app
  using (app.is_system() or app.is_admin(id)) with check (app.is_system() or app.is_admin(id));
create policy organizations_delete on organizations for delete to agencyos_app
  using (app.is_system() or app.is_owner(id));
-- Inserts happen only through app.create_organization() (SECURITY DEFINER).

create policy members_select on organization_members for select to agencyos_app
  using (app.is_system() or app.is_member(organization_id));
create policy members_insert on organization_members for insert to agencyos_app
  with check (app.is_system() or app.is_admin(organization_id));
create policy members_update on organization_members for update to agencyos_app
  using (app.is_system() or app.is_owner(organization_id))
  with check (app.is_system() or app.is_owner(organization_id));
create policy members_delete on organization_members for delete to agencyos_app
  using (app.is_system() or app.is_admin(organization_id) or user_id = app.current_user_id());

create policy invitations_all on invitations for all to agencyos_app
  using (app.is_system() or app.is_admin(organization_id))
  with check (app.is_system() or app.is_admin(organization_id));

-- -----------------------------------------------------------------------------
-- Clients (admins manage; members read)
-- -----------------------------------------------------------------------------
create policy clients_select on clients for select to agencyos_app
  using (app.is_system() or app.is_member(organization_id));
create policy clients_insert on clients for insert to agencyos_app
  with check (app.is_admin(organization_id));
create policy clients_update on clients for update to agencyos_app
  using (app.is_admin(organization_id)) with check (app.is_admin(organization_id));
create policy clients_delete on clients for delete to agencyos_app
  using (app.is_admin(organization_id));

-- -----------------------------------------------------------------------------
-- Projects, members, tasks
-- -----------------------------------------------------------------------------
create policy projects_select on projects for select to agencyos_app
  using (app.is_system() or app.can_access_project(id, organization_id));
create policy projects_insert on projects for insert to agencyos_app
  with check (app.is_admin(organization_id));
create policy projects_update on projects for update to agencyos_app
  using (app.is_admin(organization_id)) with check (app.is_admin(organization_id));
create policy projects_delete on projects for delete to agencyos_app
  using (app.is_admin(organization_id));

create policy project_members_select on project_members for select to agencyos_app
  using (app.is_member(organization_id));
create policy project_members_write on project_members for all to agencyos_app
  using (app.is_admin(organization_id)) with check (app.is_admin(organization_id));

create policy project_tasks_select on project_tasks for select to agencyos_app
  using (app.can_access_project(project_id, organization_id));
create policy project_tasks_insert on project_tasks for insert to agencyos_app
  with check (app.can_access_project(project_id, organization_id));
create policy project_tasks_update on project_tasks for update to agencyos_app
  using (app.can_access_project(project_id, organization_id))
  with check (app.can_access_project(project_id, organization_id));
create policy project_tasks_delete on project_tasks for delete to agencyos_app
  using (app.is_admin(organization_id) or (app.can_access_project(project_id, organization_id) and created_by = app.current_user_id()));

-- -----------------------------------------------------------------------------
-- Website audits (any member can run; admins delete)
-- -----------------------------------------------------------------------------
create policy audits_select on website_audits for select to agencyos_app
  using (app.is_member(organization_id));
create policy audits_insert on website_audits for insert to agencyos_app
  with check (app.is_member(organization_id) and created_by = app.current_user_id());
create policy audits_update on website_audits for update to agencyos_app
  using (app.is_member(organization_id)) with check (app.is_member(organization_id));
create policy audits_delete on website_audits for delete to agencyos_app
  using (app.is_admin(organization_id));

-- -----------------------------------------------------------------------------
-- Creator-owned content: proposals, reports, onboarding
-- -----------------------------------------------------------------------------
create policy proposals_select on proposals for select to agencyos_app
  using (app.is_member(organization_id));
create policy proposals_insert on proposals for insert to agencyos_app
  with check (app.is_member(organization_id) and created_by = app.current_user_id());
create policy proposals_update on proposals for update to agencyos_app
  using (app.can_edit_owned(organization_id, created_by))
  with check (app.can_edit_owned(organization_id, created_by));
create policy proposals_delete on proposals for delete to agencyos_app
  using (app.can_edit_owned(organization_id, created_by));

create policy proposal_sections_select on proposal_sections for select to agencyos_app
  using (app.is_member(organization_id));
create policy proposal_sections_write on proposal_sections for all to agencyos_app
  using (exists (select 1 from proposals p where p.id = proposal_id and p.organization_id = proposal_sections.organization_id
                 and app.can_edit_owned(p.organization_id, p.created_by)))
  with check (exists (select 1 from proposals p where p.id = proposal_id and p.organization_id = proposal_sections.organization_id
                 and app.can_edit_owned(p.organization_id, p.created_by)));

create policy reports_select on reports for select to agencyos_app
  using (app.is_system() or app.is_member(organization_id));
create policy reports_insert on reports for insert to agencyos_app
  with check (app.is_member(organization_id) and created_by = app.current_user_id());
create policy reports_update on reports for update to agencyos_app
  using (app.can_edit_owned(organization_id, created_by))
  with check (app.can_edit_owned(organization_id, created_by));
create policy reports_delete on reports for delete to agencyos_app
  using (app.can_edit_owned(organization_id, created_by));

create policy report_sections_select on report_sections for select to agencyos_app
  using (app.is_system() or app.is_member(organization_id));
create policy report_sections_write on report_sections for all to agencyos_app
  using (exists (select 1 from reports r where r.id = report_id and r.organization_id = report_sections.organization_id
                 and app.can_edit_owned(r.organization_id, r.created_by)))
  with check (exists (select 1 from reports r where r.id = report_id and r.organization_id = report_sections.organization_id
                 and app.can_edit_owned(r.organization_id, r.created_by)));

-- Share links: admins create/revoke; public lookups go through system context
-- after the token hash has been verified server-side.
create policy shared_reports_select on shared_reports for select to agencyos_app
  using (app.is_system() or app.is_member(organization_id));
create policy shared_reports_write on shared_reports for all to agencyos_app
  using (app.is_system() or app.is_admin(organization_id))
  with check (app.is_system() or app.is_admin(organization_id));

create policy onboarding_kits_select on onboarding_kits for select to agencyos_app
  using (app.is_member(organization_id));
create policy onboarding_kits_insert on onboarding_kits for insert to agencyos_app
  with check (app.is_member(organization_id) and created_by = app.current_user_id());
create policy onboarding_kits_update on onboarding_kits for update to agencyos_app
  using (app.can_edit_owned(organization_id, created_by))
  with check (app.can_edit_owned(organization_id, created_by));
create policy onboarding_kits_delete on onboarding_kits for delete to agencyos_app
  using (app.can_edit_owned(organization_id, created_by));

create policy onboarding_documents_select on onboarding_documents for select to agencyos_app
  using (app.is_member(organization_id));
create policy onboarding_documents_write on onboarding_documents for all to agencyos_app
  using (exists (select 1 from onboarding_kits k where k.id = kit_id and k.organization_id = onboarding_documents.organization_id
                 and app.can_edit_owned(k.organization_id, k.created_by)))
  with check (exists (select 1 from onboarding_kits k where k.id = kit_id and k.organization_id = onboarding_documents.organization_id
                 and app.can_edit_owned(k.organization_id, k.created_by)));

-- -----------------------------------------------------------------------------
-- Branding, activity, AI usage
-- -----------------------------------------------------------------------------
create policy branding_select on branding_settings for select to agencyos_app
  using (app.is_system() or app.is_member(organization_id));
create policy branding_write on branding_settings for all to agencyos_app
  using (app.is_admin(organization_id)) with check (app.is_admin(organization_id));

create policy activity_select on activity_logs for select to agencyos_app
  using (app.is_member(organization_id));
create policy activity_insert on activity_logs for insert to agencyos_app
  with check (app.is_system() or (app.is_member(organization_id) and actor_id = app.current_user_id()));

create policy ai_usage_select on ai_usage_logs for select to agencyos_app
  using (app.is_member(organization_id));
create policy ai_usage_insert on ai_usage_logs for insert to agencyos_app
  with check (app.is_member(organization_id) and user_id = app.current_user_id());

-- -----------------------------------------------------------------------------
-- Licensing & payments: system context only (members read their activation)
-- -----------------------------------------------------------------------------
create policy license_keys_system on license_keys for all to agencyos_app
  using (app.is_system()) with check (app.is_system());
create policy license_activations_select on license_activations for select to agencyos_app
  using (app.is_system() or app.is_member(organization_id));
create policy license_activations_write on license_activations for all to agencyos_app
  using (app.is_system()) with check (app.is_system());
create policy stripe_events_system on stripe_events for all to agencyos_app
  using (app.is_system()) with check (app.is_system());
create policy contact_submissions_system on contact_submissions for all to agencyos_app
  using (app.is_system()) with check (app.is_system());

-- -----------------------------------------------------------------------------
-- Multi-step operations as atomic SECURITY DEFINER functions
-- -----------------------------------------------------------------------------

-- Creates an organization, the caller's owner membership and default branding
-- in one transaction. Caps organizations per user to limit abuse.
create or replace function app.create_organization(
  p_name text, p_website text, p_industry text, p_country text,
  p_business_email text, p_brand_color text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user text := app.current_user_id();
  v_org uuid;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select count(*) into v_count from public.organization_members where user_id = v_user and role = 'owner';
  if v_count >= 10 then
    raise exception 'organization_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.organizations (name, website, industry, country, business_email, brand_color, created_by)
  values (p_name, p_website, p_industry, p_country, p_business_email, coalesce(p_brand_color, '#6366F1'), v_user)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_user, 'owner');
  insert into public.branding_settings (organization_id, company_name, contact_email)
  values (v_org, p_name, p_business_email);
  insert into public.activity_logs (organization_id, actor_id, action, entity_type, entity_id, summary)
  values (v_org, v_user, 'organization.created', 'organization', v_org, 'Created the organization');
  return v_org;
end;
$$;

-- Accepts an invitation for the current user. The invitation must be open,
-- unexpired, and addressed to the current user's email.
create or replace function app.accept_invitation(p_token_hash text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user text := app.current_user_id();
  v_email text;
  v_inv public.invitations%rowtype;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select lower(u.email) into v_email from public."user" u where u.id = v_user;

  select * into v_inv from public.invitations i where i.token_hash = p_token_hash for update;
  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  if v_inv.email <> v_email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.organization_members m where m.organization_id = v_inv.organization_id and m.user_id = v_user) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  insert into public.organization_members (organization_id, user_id, role) values (v_inv.organization_id, v_user, v_inv.role);
  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  insert into public.activity_logs (organization_id, actor_id, action, entity_type, entity_id, summary)
  values (v_inv.organization_id, v_user, 'team.joined', 'member', null, 'Joined the organization as ' || v_inv.role);
  return v_inv.organization_id;
end;
$$;

revoke all on function app.create_organization(text, text, text, text, text, text) from public;
revoke all on function app.accept_invitation(text) from public;
grant execute on function app.create_organization(text, text, text, text, text, text) to agencyos_app;
grant execute on function app.accept_invitation(text) to agencyos_app;

-- Future tables created by migrations stay locked to the app role.
alter default privileges in schema public grant select, insert, update, delete on tables to agencyos_app;
