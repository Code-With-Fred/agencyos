# Production deployment (Supabase + Vercel)

## 1. Supabase

1. Create a project. Install the Supabase CLI and run from the repository root:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   This applies `supabase/migrations` (schema, RLS, private `org-assets` storage bucket).
2. Enable the application role (SQL editor), using a generated secret:
   ```sql
   alter role agencyos_app with login password '<openssl rand -base64 32>';
   ```
3. `DATABASE_URL`: use the **transaction pooler** (port 6543) with user `agencyos_app.<project-ref>`. Do not use the `postgres` user — it bypasses RLS.
4. Copy `SUPABASE_URL` and the **service role key** into server env vars (Storage only).

## 2. Vercel

1. Import the repository (framework: Next.js; the defaults work).
2. Add all variables from `.env.example` (Production + Preview). Generate `BETTER_AUTH_SECRET` and `LICENSE_SECRET` with `openssl rand -base64 48`.
3. Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to your production domain.
4. Audits and AI generation use up to 90–120 s (`maxDuration`); enable Fluid compute or use a plan that allows it.

## 3. Stripe (one-time payments)

1. Create two one-time **Prices** (Standard, Agency) whose amounts match `src/lib/licensing/plans.ts`, and set `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_AGENCY`.
2. Add a webhook endpoint `https://<domain>/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`; set `STRIPE_WEBHOOK_SECRET`.
3. Test with `stripe listen --forward-to localhost:3000/api/stripe/webhook` and `stripe trigger checkout.session.completed` (note: triggered fixtures lack our metadata and are correctly ignored — use a real test-mode checkout from `/pricing`).

## 4. Email (optional)

Verify a sending domain in Resend; set `RESEND_API_KEY`, `EMAIL_FROM`, optionally `CONTACT_INBOX_EMAIL`.

## 5. Platform admin

Register through the app, then:
```sql
insert into platform_admins (user_id) select id from "user" where email = 'you@company.com';
```
The **License admin** page then appears in the sidebar.

## 6. Housekeeping

Schedule daily (Supabase cron or similar):
```sql
delete from rate_limits where window_start < now() - interval '2 days';
delete from "rateLimit" where "lastRequest" < (extract(epoch from now() - interval '2 days') * 1000);
delete from session where "expiresAt" < now();
```

## Pre-launch checklist

- [ ] `npm run check` passes (typecheck, lint, tests, build)
- [ ] App connects as `agencyos_app`, not `postgres`
- [ ] Legal templates (`/privacy`, `/terms`) reviewed by counsel
- [ ] Pricing amounts in `plans.ts` match Stripe Prices
- [ ] `LICENSE_SECRET` backed up in a secrets manager
