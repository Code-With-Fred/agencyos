import 'server-only'
import { z } from 'zod'

/**
 * Server environment validation. Parsed lazily so `next build` can run without
 * secrets; the first request that needs a value fails fast with a clear error.
 * Never put secrets in NEXT_PUBLIC_* variables — only the public app URL is
 * exposed to the browser.
 */
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  // Optional in preview mode (PREVIEW_MODE != 'off'), required otherwise.
  DATABASE_URL: optional,
  DATABASE_CA_CERT: optional,
  DATABASE_SSL: z.enum(['disable', 'require', 'verify']).optional(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters').optional(),
  BETTER_AUTH_URL: z.url().optional(),
  SUPABASE_URL: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  SUPABASE_STORAGE_BUCKET: z.string().default('org-assets'),
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(45000),
  PAGESPEED_API_KEY: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PRICE_STANDARD: optional,
  STRIPE_PRICE_AGENCY: optional,
  LICENSE_SECRET: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  CONTACT_INBOX_EMAIL: optional,
})

export type ServerEnv = z.infer<typeof schema>

let cached: ServerEnv | null = null

export function env(): ServerEnv {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid server environment: ${issues}`)
  }
  cached = parsed.data
  return cached
}

/** Reset cache — tests only. */
export function __resetEnvCache() {
  cached = null
}

export function appUrl(): string {
  return env().NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
}

/** Integration availability — booleans only, safe to show in the UI. */
export function integrationStatus() {
  const e = env()
  return {
    gemini: Boolean(e.GEMINI_API_KEY),
    pagespeed: Boolean(e.PAGESPEED_API_KEY),
    stripe: Boolean(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET),
    stripePrices: Boolean(e.STRIPE_PRICE_STANDARD && e.STRIPE_PRICE_AGENCY),
    email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM),
    storage: Boolean(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY),
    licensing: Boolean(e.LICENSE_SECRET && e.LICENSE_SECRET.length >= 32),
  }
}
export type IntegrationStatus = ReturnType<typeof integrationStatus>
