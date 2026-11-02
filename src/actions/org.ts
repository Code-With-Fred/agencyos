'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { runAction } from '@/lib/action'
import { ACTIVE_ORG_COOKIE, getMemberships, requireTenant, requireUser } from '@/lib/auth/session'
import { AppError } from '@/lib/errors'
import { formToObject } from '@/lib/validators/common'
import { brandingSchema, organizationSchema } from '@/lib/validators/org'
import { createOrganization, deleteOrganization, setLogo, updateBranding, updateOrganization } from '@/lib/services/organizations'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { validateImageUpload } from '@/lib/security/upload'
import { rateLimit } from '@/lib/security/rate-limit'

async function setActiveCookie(orgId: string) {
  ;(await cookies()).set(ACTIVE_ORG_COOKIE, orgId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
}

export async function createOrganizationAction(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser()
    await rateLimit({ key: `org-create:${user.id}`, limit: 5, windowSeconds: 3600 })
    const input = organizationSchema.parse(formToObject(formData))
    const orgId = await createOrganization(user.id, input)
    await setActiveCookie(orgId)
    revalidatePath('/app', 'layout')
    return { orgId }
  })
}

/** Switches the active organization only after verifying membership. */
export async function switchOrganization(orgId: string) {
  return runAction(async () => {
    const user = await requireUser()
    const memberships = await getMemberships(user.id)
    if (!memberships.some((m) => m.orgId === orgId)) throw new AppError('forbidden', 'You are not a member of that organization.')
    await setActiveCookie(orgId)
    revalidatePath('/app', 'layout')
    return null
  })
}

export async function updateOrganizationAction(formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await updateOrganization(ctx, organizationSchema.parse(formToObject(formData)))
    revalidatePath('/app', 'layout')
    return null
  })
}

export async function deleteOrganizationAction(confirmName: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deleteOrganization(ctx, confirmName)
    ;(await cookies()).delete(ACTIVE_ORG_COOKIE)
    revalidatePath('/app', 'layout')
    return null
  })
}

export async function updateBrandingAction(formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const ent = await getEntitlements(ctx.orgId)
    await updateBranding(ctx, brandingSchema.parse(formToObject(formData)), ent.whiteLabel)
    revalidatePath('/app', 'layout')
    return null
  })
}

export async function uploadLogoAction(formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await rateLimit({ key: `logo:${ctx.orgId}`, limit: 20, windowSeconds: 3600 })
    const image = await validateImageUpload(formData.get('logo'))
    await setLogo(ctx, image)
    revalidatePath('/app', 'layout')
    return null
  })
}

export async function removeLogoAction() {
  return runAction(async () => {
    const ctx = await requireTenant()
    await setLogo(ctx, null)
    revalidatePath('/app', 'layout')
    return null
  })
}
