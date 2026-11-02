import 'server-only'
import { sql } from 'kysely'
import { getDb } from '@/lib/db/pool'
import { AppError } from '@/lib/errors'

/**
 * Fixed-window rate limiter stored in Postgres, so limits hold across
 * serverless instances without extra infrastructure.
 */
export async function rateLimit(opts: { key: string; limit: number; windowSeconds: number; message?: string }): Promise<{ remaining: number }> {
  const { key, limit, windowSeconds } = opts
  const result = await sql<{ count: number; window_start: Date }>`
    insert into rate_limits (key, window_start, count)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count, window_start
  `.execute(getDb())
  const row = result.rows[0]
  if (row.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((new Date(row.window_start).getTime() + windowSeconds * 1000 - Date.now()) / 1000))
    throw new AppError('rate_limited', opts.message ?? `Too many requests. Try again in ${retryAfter} seconds.`, { retryAfter })
  }
  return { remaining: limit - row.count }
}

export function clientIp(h: Headers): string {
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim().slice(0, 64)
  return (h.get('x-real-ip') ?? 'unknown').slice(0, 64)
}
