import type { Metadata } from 'next'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu'
import { InvitationsTable, InviteDialog, MembersTable } from '@/components/team/team-manager'
import { requireOrgContext } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { listInvitations, listMembers, listTeamActivity } from '@/lib/services/team'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { integrationStatus } from '@/lib/env'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Team' }

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireOrgContext()
  const { tab } = await searchParams
  const canInvite = can(ctx.role, 'team:invite')
  const canSeeActivity = can(ctx.role, 'activity:view_team')
  const [members, invites, activity, ent] = await Promise.all([listMembers(ctx), canInvite ? listInvitations(ctx) : [], canSeeActivity ? listTeamActivity(ctx, 100) : [], getEntitlements(ctx.orgId)])

  return (
    <PageContainer>
      <PageHeader
        title="Team"
        description={`${members.length} of ${ent.maxMembers} seats used on the ${ent.name} plan`}
        actions={canInvite ? <InviteDialog actorRole={ctx.role} emailReady={integrationStatus().email} /> : null}
      />
      <Tabs defaultValue={tab === 'activity' && canSeeActivity ? 'activity' : 'members'}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          {canSeeActivity ? <TabsTrigger value="activity">Team activity</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="members" className="space-y-4">
          <MembersTable members={members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))} actorRole={ctx.role} actorUserId={ctx.userId} />
          <InvitationsTable invites={invites.map((i) => ({ ...i, expires_at: i.expires_at.toISOString(), created_at: i.created_at.toISOString() }))} />
        </TabsContent>
        {canSeeActivity ? (
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Audit log</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-border">
                {activity.length === 0 ? <li className="px-5 py-8 text-center text-[13px] text-fg-muted">No activity yet.</li> : null}
                {activity.map((a) => (
                  <li key={a.id} className="flex flex-col gap-0.5 px-5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-44 shrink-0 text-xs tabular-nums text-fg-subtle">{formatDateTime(a.created_at)}</span>
                    <span className="text-[13px] text-fg">
                      <span className="font-medium">{a.actorName ?? 'System'}</span> <span className="text-fg-muted">— {a.summary}</span>
                    </span>
                    <code className="ml-auto hidden font-mono text-2xs text-fg-subtle md:inline">{a.action}</code>
                  </li>
                ))}
              </ul>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </PageContainer>
  )
}
