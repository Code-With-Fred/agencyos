# Architecture

```
src/
  app/
    (marketing)/          Public site: /, /features, /pricing, /contact, /privacy, /terms
    (auth)/               /login, /register, /forgot-password, /reset-password, /invite/[token]
    app/setup/            Create organization (outside the workspace shell)
    app/(workspace)/      Authenticated app under /app — shell, dashboard and all modules
    share/[token]/        Public, token-verified report view (noindex)
    checkout/success/     Stripe success page (verifies the session with Stripe)
    api/                  auth, audits (NDJSON stream), pdf, share pdf, checkout, stripe webhook
  actions/                Server actions — thin: auth → validate (Zod) → service → revalidate
  components/             ui/ (design system), app/ (shell), feature folders
  lib/
    services/             Business logic per module. Every function takes a TenantContext.
    db/                   Kysely + pg pool, withUser()/withSystem(), typed schema
    auth/                 Better Auth config, session/org context, permission matrix
    ai/                   gemini.ts (single entry point), prompts/, schemas/
    audit/                Deterministic engine: parse, checks (rules), scoring, PageSpeed, run
    security/             URL validation, SSRF-safe fetch, rate limiting, origin check, uploads, tokens
    licensing/            Plans, entitlements, key crypto, activation & admin services
    payments/             Stripe Checkout + webhook processing
    pdf/                  Branded react-pdf documents and rendering
    validators/           Zod schemas for forms and actions
supabase/migrations/      Schema, RLS policies, storage bucket
tests/                    Vitest suites (unit + Postgres-backed integration)
```

## Request flow

1. `proxy.ts` (Next 16 middleware) optimistically redirects `/app/*` requests without a session cookie.
2. Layouts/pages call `requireOrgContext()`; actions/route handlers call `requireTenant()`. Both verify the Better Auth session server-side and resolve the active organization **from the user's memberships** (the `agencyos_org` cookie is only a preference).
3. Services check the role permission matrix (`lib/auth/permissions.ts`) and run queries inside `withUser(userId, …)`, which sets `app.user_id` for the transaction so Postgres RLS enforces tenant isolation. Queries also filter by `organization_id` explicitly.
4. Mutations write an `activity_logs` entry in the same transaction.

## AI service layer (`lib/ai`)

- `generateStructured(ctx, { feature, promptVersion, schema, system, prompt })` is the only way the app calls Gemini.
- Uses the official `@google/genai` SDK with `responseMimeType: application/json` and a JSON schema derived from the Zod schema.
- Output is parsed and validated with Zod; one corrective retry on invalid output; exponential backoff with jitter for 408/429/5xx/timeouts (max 3 attempts); per-request timeout.
- Enforces plan quota and per-user rate limits, then logs every call (success or failure, tokens, latency, attempts, prompt version) to `ai_usage_logs`. Prompts and outputs are never logged.
- Prompt versions live in `prompts/versions.ts` and are stored with generated records.
- Shared grounding rules forbid inventing measurements, credentials, testimonials or guarantees; untrusted input is wrapped in `<input>` data blocks.

## Audit engine (`lib/audit`)

Measurements are deterministic TypeScript; Gemini only explains.

1. `safeFetch` the URL (SSRF-safe, size/time limited, no JS execution).
2. `parsePage` with cheerio extracts title, meta, canonical, robots, headings, text, images, links, scripts, styles, forms/labels, landmarks, structured data.
3. Fetch `robots.txt`, sitemap(s), test HTTP→HTTPS redirect, HEAD-check up to 25 internal links and 12 images.
4. Optional PageSpeed Insights (lab + CrUX field data).
5. `runChecks` applies 58 issue rules across 34 recorded checks, producing issues `{id, category, severity, title, evidence, explanation, recommendation, estimate?}` plus a record of every check (pass/fail/warn/not measured).
6. `scoreAudit`: each category starts at 100; penalties Critical 30, High 15, Medium 8, Low 3, Info 0; weighted overall (Technical 30%, Content 20%, Performance 20%, Accessibility 15%, Conversion 15%). The explanation is shown in every report.
7. The AI receives a compact JSON of findings (never raw HTML), and `sanitizeAuditAi` drops any reference to issue ids that do not exist.

Progress events are streamed to the browser as NDJSON from `POST /api/audits`.

## PDFs

`@react-pdf/renderer` renders typed data (never HTML) server-side with embedded Geist fonts (`assets/fonts`, OFL). A `BrandKit` (logo from private storage, colors, footer, contact line, effective white-label flag) is loaded only after membership is verified.
