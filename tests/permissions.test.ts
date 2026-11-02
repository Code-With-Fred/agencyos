import { describe, expect, it } from 'vitest'
import { assertCan, can, canChangeRole, canEditOwned, canInviteRole, canRemoveMember, PERMISSIONS } from '@/lib/auth/permissions'

describe('role permission matrix', () => {
  it('owners can do everything', () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can('owner', p)).toBe(true)
  })
  it('admins manage clients, projects and reports but not licenses or org deletion', () => {
    expect(can('admin', 'clients:write')).toBe(true)
    expect(can('admin', 'projects:write')).toBe(true)
    expect(can('admin', 'reports:share')).toBe(true)
    expect(can('admin', 'license:manage')).toBe(false)
    expect(can('admin', 'org:delete')).toBe(false)
    expect(can('admin', 'team:change_role')).toBe(false)
  })
  it('members access assigned work only', () => {
    expect(can('member', 'clients:read')).toBe(true)
    expect(can('member', 'clients:write')).toBe(false)
    expect(can('member', 'clients:delete')).toBe(false)
    expect(can('member', 'projects:read_all')).toBe(false)
    expect(can('member', 'tasks:write_assigned')).toBe(true)
    expect(can('member', 'audits:create')).toBe(true)
    expect(can('member', 'audits:delete')).toBe(false)
    expect(can('member', 'team:invite')).toBe(false)
    expect(can('member', 'branding:update')).toBe(false)
    expect(can('member', 'onboarding:send_email')).toBe(false)
  })
  it('null roles have no permissions', () => expect(can(null, 'clients:read')).toBe(false))
  it('assertCan throws forbidden', () => expect(() => assertCan('member', 'clients:delete')).toThrow(/role does not allow/))
  it('creator-owned content', () => {
    expect(canEditOwned('member', 'u1', 'u1', 'proposals:edit_any')).toBe(true)
    expect(canEditOwned('member', 'u1', 'u2', 'proposals:edit_any')).toBe(false)
    expect(canEditOwned('admin', 'u1', 'u2', 'proposals:edit_any')).toBe(true)
    expect(canEditOwned('member', 'u1', null, 'proposals:edit_any')).toBe(false)
  })
})

describe('team management rules', () => {
  it('only owners invite admins', () => {
    expect(canInviteRole('owner', 'admin')).toBe(true)
    expect(canInviteRole('admin', 'admin')).toBe(false)
    expect(canInviteRole('admin', 'member')).toBe(true)
    expect(canInviteRole('member', 'member')).toBe(false)
  })
  it('only owners change roles and the last owner is protected', () => {
    expect(canChangeRole('admin', 'member', 'admin', 1, false).ok).toBe(false)
    expect(canChangeRole('owner', 'member', 'admin', 1, false).ok).toBe(true)
    expect(canChangeRole('owner', 'owner', 'admin', 1, true).ok).toBe(false)
    expect(canChangeRole('owner', 'owner', 'admin', 2, true).ok).toBe(true)
  })
  it('removal rules', () => {
    expect(canRemoveMember('admin', 'member', 1, false).ok).toBe(true)
    expect(canRemoveMember('admin', 'admin', 1, false).ok).toBe(false)
    expect(canRemoveMember('admin', 'owner', 2, false).ok).toBe(false)
    expect(canRemoveMember('member', 'member', 1, false).ok).toBe(false)
    expect(canRemoveMember('member', 'member', 1, true).ok).toBe(true)
    expect(canRemoveMember('owner', 'owner', 1, true).ok).toBe(false)
    expect(canRemoveMember('owner', 'owner', 2, false).ok).toBe(true)
  })
})
