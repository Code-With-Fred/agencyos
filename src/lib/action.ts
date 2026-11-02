import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { toActionError, fromPgError, type ActionResult } from '@/lib/errors'

/**
 * Wraps a server action body: returns typed results instead of throwing,
 * maps database/permission errors, and never leaks internals to the client.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    unstable_rethrow(err)
    const pg = fromPgError(err)
    return { ok: false, error: toActionError(pg ?? err) }
  }
}
