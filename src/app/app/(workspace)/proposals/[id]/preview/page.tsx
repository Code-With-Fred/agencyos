import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/ui/page'
import { ProposalDocument } from '@/components/proposals/proposal-document'
import { requireOrgContext } from '@/lib/auth/session'
import { getProposal } from '@/lib/services/proposals'
import { getBranding } from '@/lib/services/organizations'
import { signedAssetUrl } from '@/lib/storage/storage'
import { AppError } from '@/lib/errors'
import { uuid } from '@/lib/validators/common'

export const metadata: Metadata = { title: 'Proposal preview' }

export default async function ProposalPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext()
  const { id } = await params
  if (!uuid.safeParse(id).success) notFound()
  const [{ proposal, sections }, { org, branding }] = await Promise.all([
    getProposal(ctx, id).catch((e) => {
      if (e instanceof AppError && e.code === 'not_found') notFound()
      throw e
    }),
    getBranding(ctx),
  ])
  const logoUrl = await signedAssetUrl(ctx.orgId, org.logo_path)
  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/app/proposals/${id}`}>
            <ArrowLeft /> Back to editor
          </Link>
        </Button>
        <Button asChild size="sm">
          <a href={`/api/pdf/proposal/${id}`} download>
            <Download /> Export PDF
          </a>
        </Button>
      </div>
      <ProposalDocument
        template={proposal.template}
        title={proposal.title}
        clientName={proposal.clientName ?? proposal.brief.clientName}
        clientCompany={proposal.clientCompany ?? proposal.brief.clientCompany}
        agencyName={branding?.company_name || org.name}
        brandColor={org.brand_color}
        logoUrl={logoUrl}
        validUntil={proposal.valid_until}
        createdAt={proposal.created_at}
        currency={proposal.currency}
        sections={sections}
        pricing={proposal.pricing_items}
      />
    </PageContainer>
  )
}
