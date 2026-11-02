import { requireTenant } from '@/lib/auth/session'
import { errorResponse } from '@/lib/security/origin'
import { rateLimit } from '@/lib/security/rate-limit'
import { AppError } from '@/lib/errors'
import { uuid } from '@/lib/validators/common'
import { loadBrandKit } from '@/lib/pdf/brand'
import { pdfFilename, pdfResponse, renderPdf } from '@/lib/pdf/render'
import { buildPdfDocument } from '@/lib/pdf/documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TYPES = ['audit', 'proposal', 'report', 'onboarding'] as const
type PdfType = (typeof TYPES)[number]

export async function GET(_req: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { type, id } = await params
    if (!TYPES.includes(type as PdfType) || !uuid.safeParse(id).success) throw new AppError('not_found', 'Document not found.')
    const ctx = await requireTenant()
    await rateLimit({ key: `pdf:${ctx.userId}`, limit: 30, windowSeconds: 60 })
    const brand = await loadBrandKit(ctx.userId, ctx.orgId)
    const { element, name } = await buildPdfDocument(ctx, type as PdfType, id, brand)
    const buffer = await renderPdf(element)
    return pdfResponse(buffer, pdfFilename(...name))
  } catch (err) {
    return errorResponse(err)
  }
}
