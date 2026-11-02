import { AppError } from '@/lib/errors'
import type { Role } from '@/lib/db/types'

export type { Role }
export const ROLES: readonly Role[] = ['owner', 'admin', 'member'] as const

const ALL: Role[] = ['owner', 'admin', 'member']
const ADMINS: Role[] = ['owner', 'admin']
const OWNER: Role[] = ['owner']

/**
 * Single source of truth for role permissions. Mirrored at the database level
 * by RLS policies (supabase/migrations/20261102000100_rls.sql).
 */
export const PERMISSIONS = {
  'org:update': ADMINS,
  'org:delete': OWNER,
  'branding:update': ADMINS,
  'license:manage': OWNER,
  'team:view': ALL,
  'team:invite': ADMINS,
  'team:change_role': OWNER,
  'team:remove': ADMINS,
  'activity:view_team': ADMINS,
  'clients:read': ALL,
  'clients:write': ADMINS,
  'clients:delete': ADMINS,
  'projects:read_all': ADMINS,
  'projects:write': ADMINS,
  'projects:delete': ADMINS,
  'tasks:write_assigned': ALL,
  'audits:create': ALL,
  'audits:delete': ADMINS,
  'proposals:create': ALL,
  'proposals:edit_any': ADMINS,
  'reports:create': ALL,
  'reports:edit_any': ADMINS,
  'reports:share': ADMINS,
  'onboarding:create': ALL,
  'onboarding:edit_any': ADMINS,
  'onboarding:send_email': ADMINS,
  'ai:view_usage': ALL,
} as const satisfies Record<string, Role[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return (PERMISSIONS[permission] as readonly Role[]).includes(role)
}

export function assertCan(role: Role | null | undefined, permission: Permission): void {
  if (!can(role, permission)) {
    throw new AppError('forbidden', 'Your role does not allow this action.')
  }
}

/** Creator-owned records: admins edit any, members only their own. */
export function canEditOwned(role: Role, actorId: string, createdBy: string | null, anyPermission: Permission): boolean {
  return can(role, anyPermission) || (createdBy !== null && createdBy === actorId)
}

export function canInviteRole(actor: Role, inviteRole: 'admin' | 'member'): boolean {
  if (actor === 'owner') return true
  if (actor === 'admin') return inviteRole === 'member'
  return false
}

/**
 * Team-management rules:
 *  - Only owners change roles.
 *  - Owners remove anyone; admins remove members only; anyone may leave.
 *  - The last owner can never be removed or demoted (checked with ownerCount).
 */
export function canChangeRole(actor: Role, target: Role, next: Role, ownerCount: number, isSelf: boolean): { ok: boolean; reason?: string } {
  if (actor !== 'owner') return { ok: false, reason: 'Only owners can change roles.' }
  if (target === 'owner' && next !== 'owner' && ownerCount <= 1) return { ok: false, reason: 'An organization must keep at least one owner.' }
  if (isSelf && target === 'owner' && next !== 'owner' && ownerCount <= 1) return { ok: false, reason: 'Transfer ownership before stepping down.' }
  return { ok: true }
}

export function canRemoveMember(actor: Role, target: Role, ownerCount: number, isSelf: boolean): { ok: boolean; reason?: string } {
  if (target === 'owner' && ownerCount <= 1) return { ok: false, reason: 'The last owner cannot be removed.' }
  if (isSelf) return { ok: true }
  if (actor === 'owner') return { ok: true }
  if (actor === 'admin' && target === 'member') return { ok: true }
  return { ok: false, reason: 'Your role does not allow removing this member.' }
}

export const ROLE_LABELS: Record<Role, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }
