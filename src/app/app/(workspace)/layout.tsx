import { AppShell } from '@/components/app/shell'
import { isPlatformAdmin, requireOrgContext } from '@/lib/auth/session'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { getNotifications } from '@/lib/services/dashboard'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()
  const [ent, admin, notifications] = await Promise.all([getEntitlements(ctx.orgId), isPlatformAdmin(ctx.userId), getNotifications(ctx)])
  return (
    <AppShell
      user={{ name: ctx.user.name, email: ctx.user.email }}
      org={{ id: ctx.orgId, name: ctx.org.name, role: ctx.role, brandColor: ctx.org.brandColor }}
      memberships={ctx.memberships.map((m) => ({ orgId: m.orgId, name: m.name, role: m.role }))}
      planName={ent.name}
      modules={ent.modules}
      isPlatformAdmin={admin}
      notifications={notifications.map((n) => ({ id: n.id, summary: n.summary, created_at: n.created_at.toISOString(), actorName: n.actorName }))}
    >
      {children}
    </AppShell>
  )
}
