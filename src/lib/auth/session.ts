import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuth } from './auth'
import { withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import type { Role } from '@/lib/db/types'
import { isPreviewMode, PREVIEW_USER } from '@/lib/preview'

export const ACTIVE_ORG_COOKIE = 'agencyos_org'

export type SessionUser = { id: string; name: string; email: string; image: string | null }
export type Membership = { orgId: string; name: string; role: Role; logoPath: string | null; brandColor: string }

/** The verified identity + active organization for this request. */
export type TenantContext = { userId: string; orgId: string; role: Role }
export type OrgContext = TenantContext & { user: SessionUser; org: Membership; memberships: Membership[] }

export const getSession = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() })
  return session
})

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Preview mode: everyone is the sample agency owner; no sign-in needed.
  if (isPreviewMode()) return { ...PREVIEW_USER, image: null }
  const s = await getSession()
  if (!s) return null
  return { id: s.user.id, name: s.user.name, email: s.user.email, image: s.user.image ?? null }
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}

export const getMemberships = cache(async (userId: string): Promise<Membership[]> => {
  return withUser(userId, (tx) =>
    tx
      .selectFrom('organization_members as m')
      .innerJoin('organizations as o', 'o.id', 'm.organization_id')
      .select(['o.id as orgId', 'o.name', 'm.role', 'o.logo_path as logoPath', 'o.brand_color as brandColor'])
      .where('m.user_id', '=', userId)
      .orderBy('o.name')
      .execute(),
  )
})

/**
 * Resolves the active organization. The cookie is only a preference: it is
 * honoured only when the verified user is a member of that organization.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getSessionUser()
  if (!user) return null
  const memberships = await getMemberships(user.id)
  if (memberships.length === 0) return null
  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
  const org = memberships.find((m) => m.orgId === preferred) ?? memberships[0]
  return { userId: user.id, orgId: org.orgId, role: org.role, user, org, memberships }
})

/** For pages/layouts: redirects when signed out or without an organization. */
export async function requireOrgContext(): Promise<OrgContext> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const ctx = await getOrgContext()
  if (!ctx) redirect('/app/setup')
  return ctx
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireTenant(): Promise<OrgContext> {
  const user = await getSessionUser()
  if (!user) throw new AppError('unauthorized', 'Your session has expired. Please sign in again.')
  const ctx = await getOrgContext()
  if (!ctx) throw new AppError('forbidden', 'Create or join an organization first.')
  return ctx
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const row = await withUser(userId, (tx) =>
    tx.selectFrom('platform_admins').select('user_id').where('user_id', '=', userId).executeTakeFirst(),
  )
  return Boolean(row)
}
