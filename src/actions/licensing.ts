'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { runAction } from '@/lib/action'
import { requireTenant, requireUser } from '@/lib/auth/session'
import { email, optionalDate, optionalText, uuid } from '@/lib/validators/common'
import { activateLicense, adminCreateLicense, adminLicenseActivations, adminRevealKey, adminSetLicenseStatus, deactivateLicense } from '@/lib/licensing/service'

export async function activateLicenseAction(key: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const res = await activateLicense(ctx, z.string().max(64).parse(key))
    revalidatePath('/app', 'layout')
    return res
  })
}

export async function deactivateLicenseAction() {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deactivateLicense(ctx)
    revalidatePath('/app', 'layout')
    return null
  })
}

const createSchema = z.object({
  plan: z.enum(['standard', 'agency', 'enterprise']),
  customerEmail: email,
  customerName: optionalText(200),
  maxActivations: z.coerce.number().int().min(1).max(100).default(1),
  expiresAt: optionalDate,
  notes: optionalText(2000),
})

export async function adminCreateLicenseAction(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser()
    const input = createSchema.parse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')))
    const res = await adminCreateLicense(user.id, input)
    revalidatePath('/app/admin/licenses')
    return { key: res.key }
  })
}

export async function adminSetStatusAction(id: string, status: string, reason: string) {
  return runAction(async () => {
    const user = await requireUser()
    await adminSetLicenseStatus(user.id, uuid.parse(id), z.enum(['active', 'suspended', 'revoked']).parse(status), z.string().trim().max(500).parse(reason ?? '') || null)
    revalidatePath('/app/admin/licenses')
    return null
  })
}

export async function adminRevealKeyAction(id: string) {
  return runAction(async () => {
    const user = await requireUser()
    return { key: await adminRevealKey(user.id, uuid.parse(id)) }
  })
}

export async function adminActivationsAction(id: string) {
  return runAction(async () => {
    const user = await requireUser()
    const rows = await adminLicenseActivations(user.id, uuid.parse(id))
    return rows.map((r) => ({ ...r, activated_at: r.activated_at.toISOString(), deactivated_at: r.deactivated_at?.toISOString() ?? null }))
  })
}
