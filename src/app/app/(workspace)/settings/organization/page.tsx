import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/states'
import { OrganizationForm } from '@/components/settings/org-form'
import { DeleteOrganization } from '@/components/settings/account-forms'
import { requireOrgContext } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getOrganization } from '@/lib/services/organizations'

export const metadata: Metadata = { title: 'Organization settings' }

export default async function OrganizationSettingsPage() {
  const ctx = await requireOrgContext()
  const org = await getOrganization(ctx)
  const canEdit = can(ctx.role, 'org:update')
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Organization profile</CardTitle>
            <CardDescription>Used across your workspace and as defaults for client deliverables.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!canEdit ? <Notice className="mb-4">Only owners and admins can edit organization settings.</Notice> : null}
          <OrganizationForm mode="edit" initial={org} disabled={!canEdit} />
        </CardContent>
      </Card>
      {can(ctx.role, 'org:delete') ? <DeleteOrganization name={org.name} /> : null}
    </>
  )
}
