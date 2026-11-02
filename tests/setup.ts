// Test environment. DB tests run against a real local Postgres using the
// non-privileged `agencyos_app` role, so Row Level Security is enforced.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://agencyos_app:app_password@localhost:5432/agencyos_vitest'
process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret-0123456789abcdefghijkl'
process.env.BETTER_AUTH_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.LICENSE_SECRET = 'test-license-secret-0123456789abcdefghijklmnop'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
delete process.env.GEMINI_API_KEY
delete process.env.RESEND_API_KEY
delete process.env.PAGESPEED_API_KEY
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
