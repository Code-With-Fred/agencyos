import 'server-only'
import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { TenantContext } from '@/lib/auth/session'
import { AppError } from '@/lib/errors'
import { getAudit } from '@/lib/services/audits'
import { getProposal } from '@/lib/services/proposals'
import { clientVisibleSections, getReport, periodLabel } from '@/lib/services/reports'
import { getOnboardingKit } from '@/lib/services/onboarding'
import type { BrandKit } from './brand'
import { AuditPdf } from './audit-pdf'
import { ProposalPdf } from './proposal-pdf'
import { ReportPdf } from './report-pdf'
import { OnboardingPdf } from './onboarding-pdf'

type Built = { element: ReactElement<DocumentProps>; name: string[] }

/** Loads tenant-scoped data (RLS-enforced) and builds the PDF element. */
export async function buildPdfDocument(ctx: TenantContext, type: 'audit' | 'proposal' | 'report' | 'onboarding', id: string, brand: BrandKit): Promise<Built> {
  if (type === 'audit') {
    const a = await getAudit(ctx, id)
    if (a.status !== 'completed' || !a.findings || !a.issues || !a.category_scores || a.overall_score === null) throw new AppError('validation', 'Only completed audits can be exported.')
    const url = a.final_url ?? a.url
    return {
      element: <AuditPdf brand={brand} data={{ url, clientName: a.clientName, createdAt: a.created_at, overall: a.overall_score, categories: a.category_scores, issues: a.issues, findings: a.findings, ai: a.ai_analysis, preparedBy: brand.companyName }} />,
      name: ['audit', new URL(url).hostname, a.created_at.toISOString().slice(0, 10)],
    }
  }
  if (type === 'proposal') {
    const { proposal, sections } = await getProposal(ctx, id)
    return {
      element: (
        <ProposalPdf
          brand={brand}
          data={{ title: proposal.title, template: proposal.template, clientName: proposal.clientName ?? proposal.brief.clientName, clientCompany: proposal.clientCompany ?? proposal.brief.clientCompany, createdAt: proposal.created_at, validUntil: proposal.valid_until, currency: proposal.currency, sections, pricing: proposal.pricing_items }}
        />
      ),
      name: ['proposal', proposal.title],
    }
  }
  if (type === 'report') {
    const { report, sections } = await getReport(ctx, id)
    return {
      element: <ReportPdf brand={brand} data={{ title: report.title, template: report.template, clientName: report.clientName, periodLabel: periodLabel(report.period_start, report.period_end), updatedAt: report.updated_at, sections: clientVisibleSections(sections.filter((s) => s.enabled), report.metrics.length), metrics: report.metrics }} />,
      name: ['report', report.title],
    }
  }
  const { kit, docs } = await getOnboardingKit(ctx, id)
  return {
    element: <OnboardingPdf brand={brand} data={{ kitTitle: kit.title, clientName: kit.clientName, projectType: kit.project_type, docs }} />,
    name: ['onboarding', kit.title],
  }
}
