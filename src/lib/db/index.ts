import 'server-only'
import { sql, type Transaction } from 'kysely'
import { getDb } from './pool'
import type { Database } from './types'

export type Tx = Transaction<Database>
export { sql }

/**
 * Runs `fn` in a transaction scoped to a verified user. Row Level Security
 * policies read `app.user_id` to decide which organizations' rows are visible.
 * `userId` must come from a server-verified session — never from the request.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!userId) throw new Error('withUser requires a user id')
  return getDb()
    .transaction()
    .execute(async (tx) => {
      await sql`select set_config('app.user_id', ${userId}, true)`.execute(tx)
      return fn(tx)
    })
}

/**
 * Cross-tenant "system" context. Restricted to: Stripe webhooks, license
 * administration (after platform-admin check), verified share-token lookups,
 * invitation token lookups, contact form storage and rate limiting.
 */
export async function withSystem<T>(fn: (tx: Tx) => Promise<T>, userId?: string): Promise<T> {
  return getDb()
    .transaction()
    .execute(async (tx) => {
      await sql`select set_config('app.system', 'on', true)`.execute(tx)
      if (userId) await sql`select set_config('app.user_id', ${userId}, true)`.execute(tx)
      return fn(tx)
    })
}

/** Serialize a value for a jsonb column (see types.ts). */
export function json(value: unknown): string {
  return JSON.stringify(value ?? null)
}
