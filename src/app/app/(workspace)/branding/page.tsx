import type { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { BrandingForm } from '@/components/branding/branding-form'
import { requireOrgContext } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getBranding } from '@/lib/services/organizations'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { isStorageConfigured, signedAssetUrl } from '@/lib/storage/storage'

export const metadata: Metadata = { title: 'Branding' }

export default async function BrandingPage() {
  const ctx = await requireOrgContext()
  const [{ org, branding }, ent] = await Promise.all([getBranding(ctx), getEntitlements(ctx.orgId)])
  const logoUrl = await signedAssetUrl(ctx.orgId, org.logo_path)
  return (
    <PageContainer wide>
      <PageHeader title="Branding" description="Make every client deliverable look like it came from your agency." />
      <BrandingForm
        canEdit={can(ctx.role, 'branding:update')}
        whiteLabelAllowed={ent.whiteLabel}
        storageReady={isStorageConfigured()}
        logoUrl={logoUrl}
        orgName={org.name}
        values={{
          companyName: branding?.company_name ?? org.name,
          brandColor: org.brand_color,
          accentColor: branding?.accent_color ?? '#0EA5E9',
          contactEmail: branding?.contact_email ?? org.business_email ?? '',
          contactPhone: branding?.contact_phone ?? '',
          contactWebsite: branding?.contact_website ?? org.website ?? '',
          address: branding?.address ?? '',
          reportFooter: branding?.report_footer ?? '',
          reportTitleDefault: branding?.report_title_default ?? '',
          whiteLabelEnabled: branding?.white_label_enabled ?? false,
        }}
      />
    </PageContainer>
  )
}
