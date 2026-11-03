/**
 * Preview mode: explore the whole product without sign-in or an external
 * database. Every request is signed in as a sample agency owner and data lives
 * in an in-memory Postgres (PGlite) seeded with sample records.
 *
 * ON by default so a fresh deployment is browsable immediately.
 * Set PREVIEW_MODE=off to use real authentication and Supabase.
 * Edge-safe: no Node imports (used by proxy.ts).
 */
export function isPreviewMode(): boolean {
  return (process.env.PREVIEW_MODE ?? 'on').toLowerCase() !== 'off'
}

export const PREVIEW_USER = { id: 'preview_owner', name: 'Jordan Rivera', email: 'jordan@northwind-digital.example' } as const
