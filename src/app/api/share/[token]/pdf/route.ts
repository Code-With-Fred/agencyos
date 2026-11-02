import { getSharedReport } from '@/lib/services/reports'
import { loadBrandKitForShare } from '@/lib/pdf/brand'
import { pdfFilename, pdfResponse, renderPdf } from '@/lib/pdf/render'
import { ReportPdf } from '@/lib/pdf/report-pdf'
import { clientIp, rateLimit } from '@/lib/security/rate-limit'
import { errorResponse } from '@/lib/security/origin'
import { AppError } from '@/lib/errors'
import { createElement } from 'react'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    await rateLimit({ key: `share-pdf:${clientIp(req.headers)}`, limit: 10, windowSeconds: 60 })
    const report = await getSharedReport(token)
    if (!report) throw new AppError('not_found', 'This link is invalid, has expired or was revoked.')
    const brand = await loadBrandKitForShare(report.organizationId)
    const buffer = await renderPdf(createElement(ReportPdf, { brand, data: report }) as Parameters<typeof renderPdf>[0])
    return pdfResponse(buffer, pdfFilename('report', report.title))
  } catch (err) {
    return errorResponse(err)
  }
}
