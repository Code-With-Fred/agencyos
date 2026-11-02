import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Notice } from '@/components/ui/states'
import { KitEditor } from '@/components/onboarding/kit-editor'
import { requireOrgContext } from '@/lib/auth/session'
import { can, canEditOwned } from '@/lib/auth/permissions'
import { computeProgress, getOnboardingKit } from '@/lib/services/onboarding'
import { integrationStatus } from '@/lib/env'
import { AppError } from '@/lib/errors'
import { uuid } from '@/lib/validators/common'

export const metadata: Metadata = { title: 'Onboarding documents' }

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext()
  const { id } = await params
  if (!uuid.safeParse(id).success) notFound()
  const { kit, docs } = await getOnboardingKit(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === 'not_found') notFound()
    throw e
  })
  const canEdit = canEditOwned(ctx.role, ctx.userId, kit.created_by, 'onboarding:edit_any')
  return (
    <PageContainer wide>
      <PageHeader breadcrumbs={[{ label: 'Onboarding', href: '/app/onboarding' }, { label: kit.title }]} title={kit.title} description={`${kit.project_type}${kit.projectName ? ` · ${kit.projectName}` : ''}`} />
      {!canEdit ? <Notice className="mb-4">You can view these documents. Only their author or an admin can edit them.</Notice> : null}
      <Notice className="mb-4">Nothing is sent to the client automatically. Review each document, then send the welcome email explicitly or export the documents.</Notice>
      <KitEditor
        kitId={kit.id}
        docs={docs.map((d) => ({ id: d.id, doc_type: d.doc_type, title: d.title, subject: d.subject, content: d.content, items: d.items, status: d.status, sent_at: d.sent_at?.toISOString() ?? null }))}
        progress={computeProgress(docs)}
        canEdit={canEdit}
        canSend={can(ctx.role, 'onboarding:send_email')}
        emailReady={integrationStatus().email}
        clientEmail={kit.clientEmail}
      />
    </PageContainer>
  )
}
