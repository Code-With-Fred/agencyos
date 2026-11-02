'use server'
import { revalidatePath } from 'next/cache'
import { runAction } from '@/lib/action'
import { requireTenant } from '@/lib/auth/session'
import { formToObject, uuid } from '@/lib/validators/common'
import { pricingItemsSchema, proposalBriefSchema, proposalMetaSchema, sectionContentSchema, sectionKeySchema } from '@/lib/validators/documents'
import { createProposal, deleteProposal, duplicateProposal, regenerateSection, updatePricing, updateProposalMeta, updateSection } from '@/lib/services/proposals'

export async function createProposalAction(formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const id = await createProposal(ctx, proposalBriefSchema.parse(formToObject(formData)))
    revalidatePath('/app/proposals')
    return { id }
  })
}

export async function saveSectionAction(id: string, key: string, content: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await updateSection(ctx, uuid.parse(id), sectionKeySchema.parse(key), sectionContentSchema.parse(content))
    revalidatePath(`/app/proposals/${id}`)
    return null
  })
}

export async function regenerateSectionAction(id: string, key: string, instructions: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const content = await regenerateSection(ctx, uuid.parse(id), sectionKeySchema.parse(key), String(instructions ?? '').slice(0, 1000))
    revalidatePath(`/app/proposals/${id}`)
    return { content }
  })
}

export async function updateProposalMetaAction(id: string, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await updateProposalMeta(ctx, uuid.parse(id), proposalMetaSchema.parse(formToObject(formData)))
    revalidatePath(`/app/proposals/${id}`)
    revalidatePath('/app/proposals')
    return null
  })
}

export async function updatePricingAction(id: string, items: unknown) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await updatePricing(ctx, uuid.parse(id), pricingItemsSchema.parse(items))
    revalidatePath(`/app/proposals/${id}`)
    return null
  })
}

export async function duplicateProposalAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const newId = await duplicateProposal(ctx, uuid.parse(id))
    revalidatePath('/app/proposals')
    return { id: newId }
  })
}

export async function deleteProposalAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deleteProposal(ctx, uuid.parse(id))
    revalidatePath('/app/proposals')
    return null
  })
}
