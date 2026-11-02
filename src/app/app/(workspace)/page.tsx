import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Building2, FileSignature, FolderKanban, ScanSearch } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageContainer, PageHeader, Progress, StatCard } from '@/components/ui/page'
import { StatusBadge, ScorePill } from '@/components/app/status'
import { UsageChart } from '@/components/app/usage-chart'
import { QUICK_ACTIONS } from '@/components/app/nav'
import { requireOrgContext } from '@/lib/auth/session'
import { getDashboard } from '@/lib/services/dashboard'
import { getEntitlements } from '@/lib/licensing/entitlements'
import { formatRelative } from '@/lib/utils'

export const metadata: Metadata = { title: 'Overview' }

export default async function DashboardPage() {
  const ctx = await requireOrgContext()
  const [data, ent] = await Promise.all([getDashboard(ctx), getEntitlements(ctx.orgId)])
  const firstName = ctx.user.name.split(' ')[0]

  return (
    <PageContainer wide>
      <PageHeader title={`Welcome back, ${firstName}`} description={`${ctx.org.name} · ${ent.name} plan`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Clients" value={data.counts.clients} icon={<Building2 />} />
        <StatCard label="Projects" value={data.counts.projects} hint={`${data.counts.activeProjects} active`} icon={<FolderKanban />} />
        <StatCard label="Website audits" value={data.counts.audits} icon={<ScanSearch />} />
        <StatCard label="Proposals" value={data.counts.proposals} icon={<FileSignature />} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Usage — last 30 days</CardTitle>
              <CardDescription>AI generations and website audits in this organization</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <UsageChart data={data.series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>This month</CardTitle>
              <CardDescription>Fair-use limits on the {ent.name} plan</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              ['AI generations', data.usage.aiGenerations, ent.aiGenerationsPerMonth],
              ['Website audits', data.usage.audits, ent.auditsPerMonth],
            ].map(([label, used, limit]) => (
              <div key={label as string}>
                <div className="mb-2 flex justify-between text-[13px]">
                  <span className="text-fg-muted">{label}</span>
                  <span className="tabular-nums text-fg">
                    {used} <span className="text-fg-subtle">/ {limit}</span>
                  </span>
                </div>
                <Progress value={((used as number) / (limit as number)) * 100} />
              </div>
            ))}
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-2xs font-medium uppercase tracking-wider text-fg-subtle">Quick actions</p>
              <div className="space-y-0.5">
                {QUICK_ACTIONS.map((a) => (
                  <Link key={a.href} href={a.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-fg-muted hover:bg-hover hover:text-fg">
                    <a.icon className="size-4 text-fg-subtle" aria-hidden /> {a.label}
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            {ctx.role !== 'member' ? (
              <Link href="/app/team?tab=activity" className="text-xs text-fg-muted hover:text-fg">
                View all
              </Link>
            ) : null}
          </CardHeader>
          <div className="divide-y divide-border">
            {data.activity.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-fg-muted">Activity will appear here as your team works.</p>
            ) : (
              data.activity.map((a) => (
                <div key={a.id} className="px-5 py-2.5">
                  <p className="text-[13px] text-fg">
                    <span className="font-medium">{a.actorName ?? 'System'}</span> <span className="text-fg-muted">{a.summary.charAt(0).toLowerCase() + a.summary.slice(1)}</span>
                  </p>
                  <p className="text-2xs text-fg-subtle">{formatRelative(a.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent audits</CardTitle>
            <Link href="/app/audits" className="text-xs text-fg-muted hover:text-fg">
              View all
            </Link>
          </CardHeader>
          <div className="divide-y divide-border">
            {data.recentAudits.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-fg-muted">
                No audits yet. <Link href="/app/audits?new=1" className="text-accent">Run your first audit</Link>
              </p>
            ) : (
              data.recentAudits.map((a) => (
                <Link key={a.id} href={`/app/audits/${a.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-elevated/60">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{a.url.replace(/^https?:\/\//, '')}</span>
                  {a.status === 'completed' ? <ScorePill score={a.overall_score} /> : <StatusBadge status={a.status} />}
                </Link>
              ))
            )}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent reports</CardTitle>
            <Link href="/app/reports" className="text-xs text-fg-muted hover:text-fg">
              View all
            </Link>
          </CardHeader>
          <div className="divide-y divide-border">
            {data.recentReports.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-fg-muted">No client reports yet.</p>
            ) : (
              data.recentReports.map((r) => (
                <Link key={r.id} href={`/app/reports/${r.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-elevated/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-fg">{r.title}</p>
                    <p className="text-2xs text-fg-subtle">{r.clientName ?? 'No client'} · {formatRelative(r.updated_at)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                  <ArrowUpRight className="size-3.5 text-fg-subtle" aria-hidden />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
