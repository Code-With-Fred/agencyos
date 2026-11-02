# Security model

## Tenant isolation (defence in depth)

1. **Application layer** — every service receives a `TenantContext` built from the verified session; organization IDs from the browser are never trusted. Active organization = cookie preference ∩ the user's memberships.
2. **Database layer (RLS)** — the app connects as `agencyos_app` (`NOBYPASSRLS`, not a table owner). Each transaction sets `app.user_id`; policies derive access from `organization_members` via `SECURITY DEFINER` helpers (`app.is_member`, `app.is_admin`, `app.can_access_project`, `app.can_edit_owned`). A query that forgets its `WHERE organization_id` still cannot see or modify another tenant's rows (tested).
3. **Composite foreign keys** (`(client_id, organization_id)` → `clients(id, organization_id)`) make cross-tenant references impossible.
4. **System context** (`app.system = 'on'`) is used only by: Stripe webhooks, license administration (after a `platform_admins` check), token-verified share links and invitation previews, rate limiting and the contact form. It is never derived from request input.
5. Supabase's `anon`/`authenticated` roles have no grants and no policies — the publishable key can read nothing.

## Roles

| | Owner | Admin | Member |
| --- | :-: | :-: | :-: |
| Organization settings, branding | ✓ | ✓ | |
| Delete organization, manage license | ✓ | | |
| Invite members / admins | ✓ / ✓ | ✓ / — | |
| Change roles | ✓ | | |
| Remove members | ✓ | members only | self |
| Clients & projects: write | ✓ | ✓ | read clients, assigned projects only |
| Tasks | ✓ | ✓ | on assigned projects |
| Audits | ✓ (+delete) | ✓ (+delete) | run & view |
| Proposals / reports / onboarding | all | all | create; edit own |
| Share links, send client emails | ✓ | ✓ | |

The last owner cannot be removed or demoted. Mirrored by RLS policies.

## Authentication

Better Auth with email/password (min 10 chars), scrypt hashing, database sessions (7 days, rolling), `httpOnly` + `Secure` (production) cookies with an `agencyos` prefix, password reset tokens valid for 1 hour, all sessions revoked on reset, other sessions revoked on password change, database-backed rate limits on sign-in/sign-up/reset, and Origin/CSRF checks enforced explicitly in all environments.

## CSRF

Server actions use Next.js' built-in Origin verification. Cookie-authenticated route handlers call `assertSameOrigin()`. The Stripe webhook uses signature verification instead. Cookies are `SameSite=Lax`.

## Website audit SSRF protections (`lib/security`)

- http/https only; ports 80/443/8080/8443; no embedded credentials; length limit.
- Blocks localhost, `.local`/`.internal`/… suffixes, single-label hosts, numeric/hex IPv4 shorthand.
- IP checks reject loopback, RFC1918, link-local (incl. `169.254.169.254`), CGNAT, ULA, multicast, documentation/benchmark ranges and IPv6 transition ranges (IPv4-mapped, 6to4, Teredo, NAT64).
- **DNS validated at connect time**: a custom `lookup` resolves all addresses and refuses the connection if any is non-public; the socket connects to the validated address, so DNS rebinding has no window. Proxies are never used.
- Redirects followed manually (max 5), each hop fully re-validated.
- Timeouts (connect, headers, body, overall), response size caps, decompression-bomb guard.
- Pages are parsed statically — no JavaScript is executed.
- Audits are rate limited per user and per organization and capped by plan.

## Other controls

- **Uploads**: PNG/JPEG only, detected by magic bytes (SVG rejected), 2 MB limit, random object names in a private bucket; reads via short-lived signed URLs.
- **Share links / invitations**: 256-bit random tokens, stored as SHA-256 hashes, expiring, revocable; public views expose only client-facing fields.
- **License keys**: HMAC-SHA256 lookup hash + AES-256-GCM ciphertext (HKDF-derived keys); plan resolution is always server-side from the database.
- **Rate limiting**: Postgres fixed-window counters (works across serverless instances).
- **Output**: user content is rendered as React text / PDF nodes — never `dangerouslySetInnerHTML`. Errors returned to clients are generic; details stay in server logs.
- **Headers**: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP; `noindex` on `/app` and `/share`.
- **Logging**: no passwords, keys, tokens, prompts or document bodies are logged.
- **Secrets**: only `NEXT_PUBLIC_APP_URL` (and optional Supabase public values) reach the browser. Environment is validated with Zod on first use.

## Known limitations

- The CSP allows `'unsafe-inline'` scripts because Next.js injects inline bootstrap scripts; a nonce-based CSP can be added via middleware if required.
- Color contrast and JavaScript-rendered content are not measured by the static audit (reported as "not measured").
