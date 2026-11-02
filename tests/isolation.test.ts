import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'kysely'
import pg from 'pg'
import { withSystem, withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { createClient, deleteClient, getClientDetail, listClients, updateClient } from '@/lib/services/clients'
import { addTask, createProject, getProjectDetail, listProjects } from '@/lib/services/projects'
import { acceptInvitation, changeMemberRole, createInvitation, getInvitationPreview, listMembers, removeMember } from '@/lib/services/team'
import { updateOrganization } from '@/lib/services/organizations'
import type { TenantContext } from '@/lib/auth/session'
import { activateLicense, issueLicense } from '@/lib/licensing/service'
import { addMember, adminPool, closeTestDatabase, createOrgFor, createUser, resetTestDatabase } from './helpers/db'

const client = (name: string) => ({ name, company: null, email: null, phone: null, website: null, industry: null, country: null, notes: 'secret notes', status: 'active' as const })
const project = (name: string, clientId: string | null = null) => ({ name, clientId, description: null, status: 'planning' as const, deadline: null, budget: 1000, currency: 'USD', internalNotes: 'internal' })

let ownerA: TenantContext, ownerB: TenantContext, memberA: TenantContext, adminA: TenantContext
let clientA: string

beforeAll(async () => {
  await resetTestDatabase()
  const ua = await createUser('Alice Owner')
  const ub = await createUser('Bob Owner')
  const um = await createUser('Mia Member')
  const ud = await createUser('Dan Admin')
  ownerA = await createOrgFor(ua.id, 'Agency A')
  ownerB = await createOrgFor(ub.id, 'Agency B')
  const { key } = await withSystem((tx) => issueLicense(tx, { plan: 'agency', customerEmail: 'a@example.com', source: 'manual' }))
  await activateLicense(ownerA, key)
  memberA = await addMember(ownerA.orgId, um.id, 'member')
  adminA = await addMember(ownerA.orgId, ud.id, 'admin')
  clientA = await createClient(ownerA, client('Client of A'))
})
afterAll(closeTestDatabase)

const expectCode = async (p: Promise<unknown>, code: AppError['code']) => {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code)
}

describe('organization isolation (service layer)', () => {
  it('another organization cannot read, update or delete a client', async () => {
    await expectCode(getClientDetail(ownerB, clientA), 'not_found')
    await expectCode(updateClient(ownerB, clientA, client('Hijacked')), 'not_found')
    await expectCode(deleteClient(ownerB, clientA), 'not_found')
    const list = await listClients(ownerB, { q: '', status: 'all', page: 1 })
    expect(list.total).toBe(0)
  })

  it('forging another orgId in the context does not grant access (RLS checks membership)', async () => {
    const forged: TenantContext = { userId: ownerB.userId, orgId: ownerA.orgId, role: 'owner' }
    const list = await listClients(forged, { q: '', status: 'all', page: 1 })
    expect(list.total).toBe(0)
    await expect(createClient(forged, client('Injected'))).rejects.toThrow(/row-level security/)
    await expect(updateOrganization(forged, { name: 'Pwned', website: null, industry: null, country: null, businessEmail: null, brandColor: '#000000' })).rejects.toThrow()
    const org = await withUser(ownerA.userId, (tx) => tx.selectFrom('organizations').select('name').where('id', '=', ownerA.orgId).executeTakeFirstOrThrow())
    expect(org.name).toBe('Agency A')
  })

  it('cannot attach another organization’s client to a project (composite foreign key)', async () => {
    await expect(createProject(ownerB, project('Cross-tenant', clientA), [])).rejects.toThrow()
  })

  it('cannot assign users from another organization to projects', async () => {
    await expectCode(createProject(ownerA, project('With outsider'), [ownerB.userId]), 'validation')
  })
})

describe('row level security (database layer)', () => {
  it('queries without WHERE clauses only see the caller’s organizations', async () => {
    const seenByB = await withUser(ownerB.userId, (tx) => tx.selectFrom('clients').select('id').execute())
    expect(seenByB).toHaveLength(0)
    const seenByA = await withUser(ownerA.userId, (tx) => tx.selectFrom('clients').select('id').execute())
    expect(seenByA.map((r) => r.id)).toContain(clientA)
    const orgsB = await withUser(ownerB.userId, (tx) => tx.selectFrom('organizations').select('id').execute())
    expect(orgsB.map((o) => o.id)).toEqual([ownerB.orgId])
  })

  it('raw updates and deletes against another tenant affect zero rows', async () => {
    const upd = await withUser(ownerB.userId, (tx) => tx.updateTable('clients').set({ name: 'x' }).where('id', '=', clientA).executeTakeFirst())
    expect(Number(upd.numUpdatedRows)).toBe(0)
    const del = await withUser(ownerB.userId, (tx) => tx.deleteFrom('clients').where('id', '=', clientA).executeTakeFirst())
    expect(Number(del.numDeletedRows)).toBe(0)
  })

  it('connections without a user context see nothing', async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    const r = await pool.query('select count(*)::int as n from clients')
    expect(r.rows[0].n).toBe(0)
    await pool.end()
  })

  it('cannot self-insert membership into another organization', async () => {
    await expect(withUser(ownerB.userId, (tx) => tx.insertInto('organization_members').values({ organization_id: ownerA.orgId, user_id: ownerB.userId, role: 'owner' }).execute())).rejects.toThrow(/row-level security/)
  })

  it('license and payment tables are invisible outside the system context', async () => {
    const lic = await withUser(ownerA.userId, (tx) => tx.selectFrom('license_keys').select('id').execute())
    expect(lic).toHaveLength(0)
    await expect(withUser(ownerA.userId, (tx) => tx.insertInto('stripe_events').values({ id: 'evt_x', type: 'x' }).execute())).rejects.toThrow(/row-level security/)
  })

  it('Supabase API roles (anon/authenticated) have no table grants', async () => {
    const r = await adminPool().query(`select count(*)::int as n from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema = 'public'`)
    expect(r.rows[0].n).toBe(0)
  })

  it('the application role cannot bypass RLS', async () => {
    const r = await adminPool().query(`select rolbypassrls, rolsuper from pg_roles where rolname = 'agencyos_app'`)
    expect(r.rows[0]).toEqual({ rolbypassrls: false, rolsuper: false })
  })
})

describe('role permissions', () => {
  it('members can read clients but not create, edit or delete them', async () => {
    const detail = await getClientDetail(memberA, clientA)
    expect(detail.client.name).toBe('Client of A')
    await expectCode(createClient(memberA, client('Nope')), 'forbidden')
    await expectCode(updateClient(memberA, clientA, client('Nope')), 'forbidden')
    await expectCode(deleteClient(memberA, clientA), 'forbidden')
    // Even bypassing the service check, RLS rejects the write.
    await expect(withUser(memberA.userId, (tx) => tx.insertInto('clients').values({ organization_id: memberA.orgId, name: 'raw' }).execute())).rejects.toThrow(/row-level security/)
  })

  it('admins manage clients and projects', async () => {
    const id = await createClient(adminA, client('By admin'))
    await updateClient(adminA, id, client('By admin (edited)'))
    await deleteClient(adminA, id)
  })

  it('members only see projects they are assigned to', async () => {
    const assigned = await createProject(ownerA, project('Assigned to Mia'), [memberA.userId])
    const hidden = await createProject(ownerA, project('Not assigned'), [])
    const visible = await listProjects(memberA)
    expect(visible.map((p) => p.id)).toEqual([assigned])
    await expectCode(getProjectDetail(memberA, hidden), 'not_found')
    // Members can add tasks to assigned projects only.
    await addTask(memberA, assigned, { title: 'Write copy', description: null, assigneeId: memberA.userId, dueDate: null })
    await expectCode(addTask(memberA, hidden, { title: 'Sneaky', description: null, assigneeId: null, dueDate: null }), 'not_found')
    const all = await listProjects(adminA)
    expect(all.length).toBeGreaterThanOrEqual(2)
  })

  it('only owners change roles; the last owner cannot be demoted or removed', async () => {
    const members = await listMembers(ownerA)
    const mia = members.find((m) => m.userId === memberA.userId)!
    const alice = members.find((m) => m.userId === ownerA.userId)!
    await expectCode(changeMemberRole(adminA, mia.id, 'admin'), 'forbidden')
    await expectCode(changeMemberRole(ownerA, alice.id, 'member'), 'forbidden')
    await expectCode(removeMember(adminA, alice.id), 'forbidden')
    // RLS also blocks admins from editing roles directly.
    const upd = await withUser(adminA.userId, (tx) => tx.updateTable('organization_members').set({ role: 'owner' }).where('id', '=', mia.id).executeTakeFirst())
    expect(Number(upd.numUpdatedRows)).toBe(0)
  })
})

describe('invitations', () => {
  it('are hashed, expire, and can only be accepted by the invited email', async () => {
    const invitee = await createUser('Ivy Invitee', 'ivy@example.com')
    const stranger = await createUser('Sam Stranger', 'sam@example.com')
    const { token } = await createInvitation(ownerA, { email: 'ivy@example.com', role: 'member' })
    const stored = await adminPool().query('select token_hash from invitations where email = $1', ['ivy@example.com'])
    expect(stored.rows[0].token_hash).not.toBe(token)
    expect((await getInvitationPreview(token))?.status).toBe('open')
    expect(await getInvitationPreview('x'.repeat(43))).toBeNull()
    await expect(acceptInvitation(stranger.id, token)).rejects.toThrow(/invitation_email_mismatch/)
    expect(await acceptInvitation(invitee.id, token)).toBe(ownerA.orgId)
    await expect(acceptInvitation(invitee.id, token)).rejects.toThrow(/invitation_invalid/)
    expect((await getInvitationPreview(token))?.status).toBe('accepted')
  })

  it('expired invitations are rejected', async () => {
    const late = await createUser('Lee Late', 'lee@example.com')
    const { token } = await createInvitation(ownerA, { email: 'lee@example.com', role: 'member' })
    await adminPool().query(`update invitations set expires_at = now() - interval '1 minute' where email = 'lee@example.com'`)
    await expect(acceptInvitation(late.id, token)).rejects.toThrow(/invitation_expired/)
  })

  it('admins cannot invite admins and members cannot invite at all', async () => {
    await expectCode(createInvitation(adminA, { email: 'x@example.com', role: 'admin' }), 'forbidden')
    await expectCode(createInvitation(memberA, { email: 'y@example.com', role: 'member' }), 'forbidden')
  })

  it('enforces plan seat limits including pending invitations', async () => {
    // Evaluation plan allows 2 members; org B has 1 owner.
    await createInvitation(ownerB, { email: 'first@example.com', role: 'member' })
    await expectCode(createInvitation(ownerB, { email: 'second@example.com', role: 'member' }), 'limit_reached')
  })
})

describe('system context is narrowly scoped', () => {
  it('system reads work only where explicitly used', async () => {
    const n = await withSystem((tx) => tx.selectFrom('clients').select(sql<number>`count(*)`.as('n')).executeTakeFirstOrThrow())
    expect(Number(n.n)).toBeGreaterThan(0)
  })
})
