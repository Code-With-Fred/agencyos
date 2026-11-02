// Applies supabase/migrations/*.sql to a local Postgres (for development and
// tests). Usage: DATABASE_ADMIN_URL=postgres://postgres@localhost:5432/agencyos node scripts/migrate-local.mjs
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const url = process.env.DATABASE_ADMIN_URL
if (!url) {
  console.error('DATABASE_ADMIN_URL is required (a superuser/owner connection, never the app role).')
  process.exit(1)
}
const dir = path.join(process.cwd(), 'supabase', 'migrations')
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
const client = new pg.Client({ connectionString: url })
await client.connect()
await client.query('create table if not exists public._local_migrations (name text primary key, applied_at timestamptz default now())')
for (const file of files) {
  const { rowCount } = await client.query('select 1 from public._local_migrations where name = $1', [file])
  if (rowCount) continue
  const sql = await readFile(path.join(dir, file), 'utf8')
  await client.query('begin')
  try {
    await client.query(sql)
    await client.query('insert into public._local_migrations (name) values ($1)', [file])
    await client.query('commit')
    console.info(`applied ${file}`)
  } catch (err) {
    await client.query('rollback')
    console.error(`failed ${file}:`, err.message)
    process.exit(1)
  }
}
await client.end()
