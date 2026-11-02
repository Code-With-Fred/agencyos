import 'server-only'
import { sql } from 'kysely'
import { withSystem, withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { assertCan, canChangeRole, canInviteRole, canRemoveMember, type Role } from '@/lib/auth/permissions'
import type { TenantContext } from '@/lib/auth/session'
import { generateToken, hashToken, isPlausibleToken } from '@/lib/security/tokens'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { logActivity } from './activity'

export const INVITATION_TTL_DAYS = 7

export async function listMembers(ctx: TenantContext) {
  return withUser(ctx.userId, (tx) =>
    tx
      .selectFrom('organization_members as m')
      .innerJoin('user as u', 'u.id', 'm.user_id')
      .select(['m.id', 'm.user_id as userId', 'm.role', 'm.created_at as joinedAt', 'u.name', 'u.email'])
      .where('m.organization_id', '=', ctx.orgId)
      .orderBy(sql`case m.role when 'owner' then 0 when 'admin' then 1 else 2 end`)
      .orderBy('u.name')
      .execute(),
  )
}

export async function listInvitations(ctx: TenantContext) {
  assertCan(ctx.role, 'team:invite')
  return withUser(ctx.userId, (tx) =>
    tx
      .selectFrom('invitations')
      .select(['id', 'email', 'role', 'expires_at', 'created_at'])
      .where('organization_id', '=', ctx.orgId)
      .where('accepted_at', 'is', null)
      .where('revoked_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute(),
  )
}

/** Returns the raw token exactly once; only its SHA-256 hash is stored. */
export async function createInvitation(ctx: TenantContext, input: { email: string; role: 'admin' | 'member' }) {
  assertCan(ctx.role, 'team:invite')
  if (!canInviteRole(ctx.role, input.role)) throw new AppError('forbidden', 'Only owners can invite administrators.')
  const ent = await getEntitlements(ctx.orgId)
  const token = generateToken(32)
  await withUser(ctx.userId, async (tx) => {
    const [{ n: members }] = await tx.selectFrom('organization_members').select(sql<number>`count(*)`.as('n')).where('organization_id', '=', ctx.orgId).execute()
    const [{ n: pending }] = await tx
      .selectFrom('invitations')
      .select(sql<number>`count(*)`.as('n'))
      .where('organization_id', '=', ctx.orgId)
      .where('accepted_at', 'is', null)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date())
      .execute()
    if (Number(members) + Number(pending) >= ent.maxMembers) {
      throw new AppError('limit_reached', `Your ${ent.name} plan allows up to ${ent.maxMembers} team members (including pending invitations).`)
    }
    const existing = await tx
      .selectFrom('organization_members as m')
      .innerJoin('user as u', 'u.id', 'm.user_id')
      .select('m.id')
      .where('m.organization_id', '=', ctx.orgId)
      .where(sql`lower(u.email)`, '=', input.email)
      .executeTakeFirst()
    if (existing) throw new AppError('conflict', 'That person is already a member of this organization.')
    // Replace any open invitation for the same email.
    await tx.updateTable('invitations').set({ revoked_at: new Date() }).where('organization_id', '=', ctx.orgId).where('email', '=', input.email).where('accepted_at', 'is', null).where('revoked_at', 'is', null).execute()
    const inv = await tx
      .insertInto('invitations')
      .values({
        organization_id: ctx.orgId,
        email: input.email,
        role: input.role,
        token_hash: hashToken(token),
        invited_by: ctx.userId,
        expires_at: new Date(Date.now() + INVITATION_TTL_DAYS * 86400_000),
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    await logActivity(tx, ctx, { action: 'team.invited', entityType: 'invitation', entityId: inv.id, summary: `Invited ${input.email} as ${input.role}` })
  })
  return { token }
}

export async function revokeInvitation(ctx: TenantContext, invitationId: string) {
  assertCan(ctx.role, 'team:invite')
  await withUser(ctx.userId, async (tx) => {
    const res = await tx.updateTable('invitations').set({ revoked_at: new Date() }).where('id', '=', invitationId).where('organization_id', '=', ctx.orgId).where('accepted_at', 'is', null).returning('email').executeTakeFirst()
    if (!res) throw new AppError('not_found', 'Invitation not found.')
    await logActivity(tx, ctx, { action: 'team.invite_revoked', entityType: 'invitation', entityId: invitationId, summary: `Revoked invitation for ${res.email}` })
  })
}

async function ownerCount(ctx: TenantContext) {
  return withUser(ctx.userId, async (tx) => {
    const r = await tx.selectFrom('organization_members').select(sql<number>`count(*)`.as('n')).where('organization_id', '=', ctx.orgId).where('role', '=', 'owner').executeTakeFirstOrThrow()
    return Number(r.n)
  })
}

export async function changeMemberRole(ctx: TenantContext, memberId: string, nextRole: Role) {
  assertCan(ctx.role, 'team:change_role')
  const owners = await ownerCount(ctx)
  await withUser(ctx.userId, async (tx) => {
    const target = await tx.selectFrom('organization_members').select(['user_id', 'role']).where('id', '=', memberId).where('organization_id', '=', ctx.orgId).executeTakeFirst()
    if (!target) throw new AppError('not_found', 'Member not found.')
    const check = canChangeRole(ctx.role, target.role, nextRole, owners, target.user_id === ctx.userId)
    if (!check.ok) throw new AppError('forbidden', check.reason ?? 'Not allowed.')
    await tx.updateTable('organization_members').set({ role: nextRole }).where('id', '=', memberId).where('organization_id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: 'team.role_changed', entityType: 'member', summary: `Changed a member's role from ${target.role} to ${nextRole}` })
  })
}

export async function removeMember(ctx: TenantContext, memberId: string) {
  const owners = await ownerCount(ctx)
  await withUser(ctx.userId, async (tx) => {
    const target = await tx
      .selectFrom('organization_members as m')
      .innerJoin('user as u', 'u.id', 'm.user_id')
      .select(['m.user_id', 'm.role', 'u.name'])
      .where('m.id', '=', memberId)
      .where('m.organization_id', '=', ctx.orgId)
      .executeTakeFirst()
    if (!target) throw new AppError('not_found', 'Member not found.')
    const isSelf = target.user_id === ctx.userId
    if (!isSelf) assertCan(ctx.role, 'team:remove')
    const check = canRemoveMember(ctx.role, target.role, owners, isSelf)
    if (!check.ok) throw new AppError('forbidden', check.reason ?? 'Not allowed.')
    await logActivity(tx, ctx, { action: isSelf ? 'team.left' : 'team.removed', entityType: 'member', summary: isSelf ? 'Left the organization' : `Removed ${target.name} from the organization` })
    await tx.deleteFrom('project_members').where('organization_id', '=', ctx.orgId).where('user_id', '=', target.user_id).execute()
    await tx.deleteFrom('organization_members').where('id', '=', memberId).where('organization_id', '=', ctx.orgId).execute()
  })
}

/** Public preview of an invitation (minimal fields) after verifying the token hash. */
export async function getInvitationPreview(token: string) {
  if (!isPlausibleToken(token)) return null
  return withSystem(async (tx) => {
    const inv = await tx
      .selectFrom('invitations as i')
      .innerJoin('organizations as o', 'o.id', 'i.organization_id')
      .leftJoin('user as u', 'u.id', 'i.invited_by')
      .select(['i.email', 'i.role', 'i.expires_at', 'i.accepted_at', 'i.revoked_at', 'o.name as orgName', 'u.name as inviterName'])
      .where('i.token_hash', '=', hashToken(token))
      .executeTakeFirst()
    if (!inv) return null
    const status = inv.revoked_at ? 'revoked' : inv.accepted_at ? 'accepted' : inv.expires_at.getTime() <= Date.now() ? 'expired' : 'open'
    return { email: inv.email, role: inv.role, orgName: inv.orgName, inviterName: inv.inviterName, status, expiresAt: inv.expires_at }
  })
}

export async function acceptInvitation(userId: string, token: string): Promise<string> {
  if (!isPlausibleToken(token)) throw new AppError('not_found', 'This invitation is no longer valid.')
  return withUser(userId, async (tx) => {
    const res = await sql<{ id: string }>`select app.accept_invitation(${hashToken(token)}) as id`.execute(tx)
    return res.rows[0].id
  })
}

export async function listTeamActivity(ctx: TenantContext, limit = 50) {
  assertCan(ctx.role, 'activity:view_team')
  return withUser(ctx.userId, (tx) =>
    tx
      .selectFrom('activity_logs as a')
      .leftJoin('user as u', 'u.id', 'a.actor_id')
      .select(['a.id', 'a.action', 'a.summary', 'a.entity_type', 'a.entity_id', 'a.created_at', 'u.name as actorName'])
      .where('a.organization_id', '=', ctx.orgId)
      .orderBy('a.created_at', 'desc')
      .limit(limit)
      .execute(),
  )
}
