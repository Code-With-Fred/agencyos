# Licensing & payments

## Plans (`src/lib/licensing/plans.ts`)

| | Evaluation (no license) | Standard | Agency | Enterprise |
| --- | --- | --- | --- | --- |
| Price | — | $490 one-time | $1,490 one-time | Negotiated |
| Modules | All (low limits) | Clients, projects, audits, proposals | All | All |
| White-label | — | — | ✓ | ✓ |
| Members | 2 | 3 | 15 | Custom |
| AI generations / month | 10 | 300 | 1,500 | Custom |
| Audits / month | 5 | 150 | 750 | Custom |

Limits are fair-use allowances for the hosted service, which depends on continued hosting, database and AI API costs. Edit `plans.ts` to change them (and keep Stripe prices in sync).

## Keys

`AGOS-XXXXX-XXXXX-XXXXX-XXXXX` — 19 random Crockford base32 characters + 1 checksum (~95 bits). Stored as an HMAC-SHA256 hash (lookup) and AES-256-GCM ciphertext (so admins and the checkout success page can re-display it). Keys derive from `LICENSE_SECRET` via HKDF.

## Lifecycle

1. **Purchase** — `/pricing` → `POST /api/checkout` creates a one-time Stripe Checkout Session with server-set metadata.
2. **Verified payment** — the webhook verifies the Stripe signature, records the event id (idempotency), and issues a license only for `payment_status = paid` sessions of our product. A unique constraint on the session id prevents duplicates even under concurrent deliveries. The key is shown on `/checkout/success` (after re-verifying the session with Stripe) and emailed if email is configured.
3. **Manual sales** — platform admins issue licenses (plan, max activations, optional expiry, notes) for bank transfers and Enterprise deals.
4. **Activation** — an organization **owner** enters the key under Settings → License. The server checks format, existence, status, expiry and activation count, and replaces any previous license for the org.
5. **Enforcement** — every request resolves the plan from `license_activations` + `license_keys` in the database. Browser state cannot change it.
6. **Revocation** — admins can suspend (reversible) or revoke (permanent; deactivates everywhere). Full refunds (`charge.refunded`) revoke automatically. Expired licenses fall back to Evaluation immediately.

## Self-hosted deployments

Offered only under a separately negotiated Enterprise agreement. A self-hosted customer runs this same codebase with their own Supabase, Vercel (or Node host), AI keys and `LICENSE_SECRET`; the vendor issues their license manually.
