import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { __closeDb } from '@/lib/db/pool'
import { createOrganization } from '@/lib/services/organizations'
import type { TenantContext } from '@/lib/auth/session'
import type { Role } from '@/lib/db/types'

const ADMIN_URL = process.env.TEST_ADMIN_URL ?? 'postgres://postgres:postgres@localhost:5432'
const DB_NAME = 'agencyos_vitest'

let admin: pg.Pool | null = null

/** Superuser pool for test fixtures only (never used by application code). */
export function adminPool() {
  admin ??= new pg.Pool({ connectionString: `${ADMIN_URL}/${DB_NAME}`, max: 2 })
  return admin
}

export async function resetTestDatabase() {
  await __closeDb()
  await admin?.end()
  admin = null
  const root = new pg.Client({ connectionString: `${ADMIN_URL}/postgres` })
  await root.connect()
  await root.query(`drop database if exists ${DB_NAME} with (force)`)
  await root.query(`create database ${DB_NAME}`)
  await root.end()
  const c = new pg.Client({ connectionString: `${ADMIN_URL}/${DB_NAME}` })
  await c.connect()
  const dir = path.join(process.cwd(), 'supabase', 'migrations')
  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.sql')).sort()) {
    await c.query(await readFile(path.join(dir, f), 'utf8'))
  }
  await c.query(`alter role agencyos_app with login password 'app_password'`)
  await c.end()
}

export async function closeTestDatabase() {
  await __closeDb()
  await admin?.end()
  admin = null
}

let seq = 0
export async function createUser(name = 'Test User', email?: string) {
  seq++
  const id = `user_${Date.now().toString(36)}_${seq}`
  const addr = (email ?? `${id}@example.com`).toLowerCase()
  await adminPool().query(`insert into "user"(id, name, email, "emailVerified") values ($1, $2, $3, true)`, [id, name, addr])
  return { id, email: addr, name }
}

export async function createOrgFor(userId: string, name = 'Acme Agency'): Promise<TenantContext> {
  const orgId = await createOrganization(userId, { name, website: null, industry: null, country: null, businessEmail: null, brandColor: '#6D6AF5' })
  return { userId, orgId, role: 'owner' }
}

export async function addMember(orgId: string, userId: string, role: Role): Promise<TenantContext> {
  await adminPool().query(`insert into organization_members(organization_id, user_id, role) values ($1, $2, $3)`, [orgId, userId, role])
  return { userId, orgId, role }
}
