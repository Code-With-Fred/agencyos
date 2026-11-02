import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { PageContainer, PageHeader, Progress } from '@/components/ui/page'
import { EmptyState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { ModuleGate } from '@/components/app/module-gate'
import { NewKitForm } from '@/components/onboarding/new-kit'
import { requireOrgContext } from '@/lib/auth/session'
import { listOnboardingKits, PROJECT_TYPES } from '@/lib/services/onboarding'
import { clientOptions } from '@/lib/services/clients'
import { listProjects } from '@/lib/services/projects'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { integrationStatus } from '@/lib/env'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Onboarding' }
export const maxDuration = 90

export default async function OnboardingPage() {
  const ctx = await requireOrgContext()
  const ent = await getEntitlements(ctx.orgId)
  const [kits, clients, projects] = await Promise.all([listOnboardingKits(ctx), clientOptions(ctx), listProjects(ctx)])
  return (
    <PageContainer wide>
      <PageHeader title="Client onboarding" description="Welcome emails, questionnaires, requirements, checklists, asset lists, kickoff agendas and communication guidelines." />
      <ModuleGate ent={ent} module="onboarding">
        <div className="space-y-6">
          <NewKitForm clients={clients} projects={projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))} projectTypes={PROJECT_TYPES} aiReady={integrationStatus().gemini} />
          <Card>
            <CardHeader>
              <CardTitle>Onboarding history</CardTitle>
            </CardHeader>
            {kits.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={ClipboardList} title="No onboarding documents yet" description="Generate your first onboarding pack above." />
              </div>
            ) : (
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Onboarding</TH>
                    <TH>Client</TH>
                    <TH>Documents</TH>
                    <TH className="w-48">Progress</TH>
                    <TH className="hidden md:table-cell">Created</TH>
                  </TR>
                </THead>
                <TBody>
                  {kits.map((k) => (
                    <TR key={k.id}>
                      <TD>
                        <Link href={`/app/onboarding/${k.id}`} className="font-medium text-fg hover:underline">
                          {k.title}
                        </Link>
                        <p className="text-xs text-fg-subtle">{k.project_type}</p>
                      </TD>
                      <TD>{k.clientName ?? '—'}</TD>
                      <TD className="tabular-nums">{k.documentCount}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Progress value={k.progress.percent} />
                          <span className="w-9 text-right text-xs tabular-nums">{k.progress.percent}%</span>
                        </div>
                      </TD>
                      <TD className="hidden md:table-cell">{formatDate(k.created_at)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
      </ModuleGate>
    </PageContainer>
  )
}
