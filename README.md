# AgencyOS AI — AI Agency Operations Toolkit

A multi-tenant B2B SaaS for SEO, digital marketing and web development agencies:

| Module | What it does |
| --- | --- |
| **AI Website Audit Generator** | Server-side inspection of a live site (technical SEO, content, performance, accessibility, conversion/UX) with SSRF protection, rule-based transparent scoring, optional PageSpeed Insights field data, and Gemini explanations of the *measured* findings. |
| **AI Proposal Generator** | Structured proposals from a brief; edit or regenerate any section; three templates; pricing split only from the budget you enter; duplicate, preview, PDF. |
| **White-Label Client Reporting** | Reports from audits, project progress and *verified* metrics; AI executive summaries; customizable sections; branded PDFs; revocable, expiring share links. |
| **AI Client Onboarding Generator** | Welcome email, questionnaire, requirements doc, checklist, asset list, kickoff agenda and communication guidelines; checklist progress tracking; explicit-only email sending. |

Plus client & project management, teams with Owner/Admin/Member roles, organization switching, branding/white-label, activity logs, one-time licensing with Stripe Checkout, and a platform license-admin console.


## Stack

Next.js 16 (App Router, server actions, route handlers) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn-style components on Radix UI · Lucide · Recharts · Motion · Better Auth (email/password) · Supabase Postgres + Storage · Kysely · Google GenAI SDK (Gemini) · Stripe · @react-pdf/renderer · Zod · Vitest.

## Quick start (local)

```bash
npm install
cp .env.example .env.local   # fill in at least DATABASE_URL, BETTER_AUTH_SECRET, LICENSE_SECRET
```

Apply migrations to a local Postgres (16+) and enable the app role:

```bash
createdb agencyos
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/agencyos npm run db:migrate:local
psql agencyos -c "alter role agencyos_app with login password 'app_password'"
```

Then `DATABASE_URL=postgres://agencyos_app:app_password@localhost:5432/agencyos` and:

```bash
npm run dev
```

Register at `/register`, create your organization, and you are in. To use the license console, grant yourself platform admin (see `supabase/seed.sql`).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules) |
| `npm test` | Vitest — needs a local Postgres (see `tests/setup.ts`; override with `TEST_ADMIN_URL`) |
| `npm run check` | All of the above |

## What works without which credentials

The app never fakes a working integration. Missing services show a clear setup state (see **Integrations** in the app):

| Missing | Behaviour |
| --- | --- |
| `GEMINI_API_KEY` | Audits still run with measured findings, evidence, fixes and scores; proposals/onboarding can be written manually; AI buttons are disabled with an explanation. |
| `PAGESPEED_API_KEY` | Core Web Vitals reported as **not measured** — never estimated. |
| Supabase Storage keys | Logo upload disabled; exports use the company name. |
| `RESEND_API_KEY` | Invitation links are copyable; reset links print to the server console in development only; welcome emails can't be sent. |
| Stripe keys | Online checkout disabled; licenses can be issued manually by a platform admin. |
| `LICENSE_SECRET` | License issuance/activation disabled. |

## Documentation

- [docs/architecture.md](docs/architecture.md) — structure, data flow, AI layer, audit engine
- [docs/security.md](docs/security.md) — tenant isolation, RLS, SSRF, CSRF, rate limits, secrets
- [docs/deployment.md](docs/deployment.md) — Supabase + Vercel + Stripe production setup
- [docs/licensing.md](docs/licensing.md) — plans, keys, activation, payments, self-hosted option

## Hosted service note

The hosted product depends on continued hosting, database and AI API services; plans include fair-use monthly limits. Self-hosted deployments are available under separately negotiated Enterprise agreements.
