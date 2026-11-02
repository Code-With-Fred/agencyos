-- =============================================================================
-- AgencyOS AI — seed script
-- -----------------------------------------------------------------------------
-- This seed does NOT create fake customers or demo records. Real data is
-- created through the application. It only contains operator setup steps that
-- must be run deliberately.
-- =============================================================================

-- 1) Enable the application login role (run once; use a generated secret):
--    alter role agencyos_app with login password 'REPLACE_WITH_GENERATED_SECRET';

-- 2) Grant platform administration (license management) to a registered user.
--    Register through the app first, then run:
--    insert into platform_admins (user_id)
--    select id from "user" where email = 'you@your-company.com'
--    on conflict do nothing;

-- 3) Housekeeping: purge expired rate-limit windows (safe to schedule daily).
delete from rate_limits where window_start < now() - interval '2 days';
