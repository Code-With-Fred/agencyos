'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { runAction } from '@/lib/action'
import { requireTenant } from '@/lib/auth/session'
import { uuid } from '@/lib/validators/common'
import { onboardingCreateSchema, onboardingDocUpdateSchema } from '@/lib/validators/documents'
import { createOnboardingKit, deleteOnboardingKit, sendWelcomeEmail, setChecklistItems, updateOnboardingDoc } from '@/lib/services/onboarding'

const itemsSchema = z.array(z.object({ id: z.string().min(1).max(64), label: z.string().trim().min(1).max(300), done: z.boolean() })).max(60)

export async function createOnboardingKitAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const id = await createOnboardingKit(ctx, onboardingCreateSchema.parse(input))
    revalidatePath('/app/onboarding')
    return { id }
  })
}

export async function updateOnboardingDocAction(kitId: string, docId: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await updateOnboardingDoc(ctx, uuid.parse(kitId), uuid.parse(docId), onboardingDocUpdateSchema.parse(input))
    revalidatePath(`/app/onboarding/${kitId}`)
    return null
  })
}

export async function setChecklistItemsAction(kitId: string, docId: string, items: unknown) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await setChecklistItems(ctx, uuid.parse(kitId), uuid.parse(docId), itemsSchema.parse(items))
    revalidatePath(`/app/onboarding/${kitId}`)
    revalidatePath('/app/onboarding')
    return null
  })
}

export async function sendWelcomeEmailAction(kitId: string, docId: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const res = await sendWelcomeEmail(ctx, uuid.parse(kitId), uuid.parse(docId))
    revalidatePath(`/app/onboarding/${kitId}`)
    return res
  })
}

export async function deleteOnboardingKitAction(kitId: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deleteOnboardingKit(ctx, uuid.parse(kitId))
    revalidatePath('/app/onboarding')
    return null
  })
}
