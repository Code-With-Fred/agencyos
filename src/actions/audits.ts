'use server'
import { revalidatePath } from 'next/cache'
import { runAction } from '@/lib/action'
import { requireTenant } from '@/lib/auth/session'
import { uuid } from '@/lib/validators/common'
import { deleteAudit, regenerateAuditAnalysis } from '@/lib/services/audits'

export async function regenerateAuditAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await regenerateAuditAnalysis(ctx, uuid.parse(id))
    revalidatePath(`/app/audits/${id}`)
    return null
  })
}

export async function deleteAuditAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deleteAudit(ctx, uuid.parse(id))
    revalidatePath('/app/audits')
    return null
  })
}
