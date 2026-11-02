'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { runAction } from '@/lib/action'
import { requireTenant } from '@/lib/auth/session'
import { appUrl } from '@/lib/env'
import { formToObject, optionalDate, optionalUuid, requiredText, uuid } from '@/lib/validators/common'
import { metricsSchema, reportCreateSchema, reportSectionUpdateSchema, shareSchema } from '@/lib/validators/documents'
import { addCustomSection, createReport, createShareLink, deleteCustomSection, deleteReport, generateReportSummary, moveReportSection, refreshReportData, revokeShareLink, updateMetrics, updateReportMeta, updateReportSection } from '@/lib/services/reports'

const metaSchema = z.object({ title: requiredText(200, 'Title'), template: z.enum(['executive', 'detailed']), status: z.enum(['draft', 'final']), periodStart: optionalDate, periodEnd: optionalDate, auditId: optionalUuid })

export async function createReportAction(formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const id = await createReport(ctx, reportCreateSchema.parse(formToObject(formData)))
    revalidatePath('/app/reports')
    return { id }
  })
}

export async function updateReportMetaAction(id: string, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await updateReportMeta(ctx, uuid.parse(id), metaSchema.parse(formToObject(formData)))
    revalidatePath(`/app/reports/${id}`)
    return null
  })
}

export async function generateReportSummaryAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await generateReportSummary(ctx, uuid.parse(id))
    revalidatePath(`/app/reports/${id}`)
    return null
  })
}

export async function refreshReportDataAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await refreshReportData(ctx, uuid.parse(id))
    revalidatePath(`/app/reports/${id}`)
    return null
  })
}

export async function updateReportSectionAction(id: string, sectionId: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await updateReportSection(ctx, uuid.parse(id), uuid.parse(sectionId), reportSectionUpdateSchema.parse(input))
    revalidatePath(`/app/reports/${id}`)
    return null
  })
}

export async function moveReportSectionAction(id: string, sectionId: string, direction: 'up' | 'down') {
  return runAction(async () => {
    const ctx = await requireTenant()
    await moveReportSection(ctx, uuid.parse(id), uuid.parse(sectionId), z.enum(['up', 'down']).parse(direction))
    revalidatePath(`/app/reports/${id}`)
    return null
  })
}

export async function addCustomSectionAction(id: string, title: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await addCustomSection(ctx, uuid.parse(id), requiredText(160, 'Title').parse(title))
    revalidatePath(`/app/reports/${id}`)
    return null
  })
}

export async function deleteCustomSectionAction(id: string, sectionId: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deleteCustomSection(ctx, uuid.parse(id), uuid.parse(sectionId))
    revalidatePath(`/app/reports/${id}`)
    return null
  })
}

export async function updateMetricsAction(id: string, metrics: unknown) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await updateMetrics(ctx, uuid.parse(id), metricsSchema.parse(metrics))
    revalidatePath(`/app/reports/${id}`)
    return null
  })
}

export async function createShareLinkAction(id: string, expiresInDays: number) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const { expiresInDays: days } = shareSchema.parse({ expiresInDays })
    const { token } = await createShareLink(ctx, uuid.parse(id), days)
    revalidatePath(`/app/reports/${id}`)
    return { url: `${appUrl()}/share/${token}` }
  })
}

export async function revokeShareLinkAction(id: string, shareId: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await revokeShareLink(ctx, uuid.parse(id), uuid.parse(shareId))
    revalidatePath(`/app/reports/${id}`)
    return null
  })
}

export async function deleteReportAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deleteReport(ctx, uuid.parse(id))
    revalidatePath('/app/reports')
    return null
  })
}
