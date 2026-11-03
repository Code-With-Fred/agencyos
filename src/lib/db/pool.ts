import 'server-only'
import pg from 'pg'
import { Kysely, PGliteDialect, PostgresDialect } from 'kysely'
import { env } from '@/lib/env'
import type { Database } from './types'
import { isPreviewMode } from '@/lib/preview'
import type { PGlite } from '@electric-sql/pglite'

// date -> 'YYYY-MM-DD' (avoid timezone shifts), numeric -> number, int8 -> number
pg.types.setTypeParser(1082, (v: string) => v)
pg.types.setTypeParser(1700, (v: string) => Number.parseFloat(v))
pg.types.setTypeParser(20, (v: string) => Number(v))

type DbGlobal = { __agencyosPool?: pg.Pool; __agencyosDb?: Kysely<Database>; __agencyosPreview?: Promise<PGlite> }
const g = globalThis as unknown as DbGlobal

export function buildPoolConfig(databaseUrl: string, opts: { ssl?: 'disable' | 'require' | 'verify'; ca?: string } = {}): pg.PoolConfig {
  const url = new URL(databaseUrl)
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  // sslmode in the URL would override the explicit ssl config below.
  url.searchParams.delete('sslmode')
  const mode = opts.ssl ?? (isLocal ? 'disable' : opts.ca ? 'verify' : 'require')
  const ssl: pg.PoolConfig['ssl'] =
    mode === 'disable'
      ? false
      : mode === 'verify'
        ? { ca: opts.ca?.replace(/\\n/g, '\n'), rejectUnauthorized: true }
        : { rejectUnauthorized: false }
  return {
    connectionString: url.toString(),
    ssl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    application_name: 'agencyos',
  }
}

export function getPool(): pg.Pool {
  if (!g.__agencyosPool) {
    const e = env()
    if (!e.DATABASE_URL) throw new Error('DATABASE_URL is required when PREVIEW_MODE=off')
    g.__agencyosPool = new pg.Pool(buildPoolConfig(e.DATABASE_URL, { ssl: e.DATABASE_SSL, ca: e.DATABASE_CA_CERT }))
    g.__agencyosPool.on('error', (err) => console.error('[db] idle client error', err.message))
  }
  return g.__agencyosPool
}

/** Raw Kysely instance. Application code must use withUser/withSystem. */
export function getDb(): Kysely<Database> {
  if (!g.__agencyosDb) {
    if (isPreviewMode()) {
      // In-memory Postgres with sample data — see lib/db/preview-db.ts.
      const pglite = () => (g.__agencyosPreview ??= import('./preview-db').then((m) => m.createPreviewDatabase()))
      g.__agencyosDb = new Kysely<Database>({ dialect: new PGliteDialect({ pglite }) })
    } else {
      g.__agencyosDb = new Kysely<Database>({ dialect: new PostgresDialect({ pool: getPool() }) })
    }
  }
  return g.__agencyosDb
}

/** Tests only. */
export async function __closeDb() {
  await g.__agencyosDb?.destroy()
  g.__agencyosDb = undefined
  g.__agencyosPool = undefined
}
