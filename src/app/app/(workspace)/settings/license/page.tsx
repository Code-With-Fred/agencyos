import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/page'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { ActivateLicense, DeactivateLicense } from '@/components/settings/license-panel'
import { requireOrgContext } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getLicenseOverview } from '@/lib/licensing/service'
import { monthlyUsage } from '@/lib/licensing/entitlements'
import { MODULE_LABELS, type Module } from '@/lib/licensing/plans'
import { integrationStatus } from '@/lib/env'
import { withUser } from '@/lib/db'
import { sql } from 'kysely'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'License' }

export default async function LicensePage() {
  const ctx = await requireOrgContext()
  const [{ ent, history }, usage, members] = await Promise.all([
    getLicenseOverview(ctx),
    withUser(ctx.userId, (tx) => monthlyUsage(tx, ctx.orgId)),
    withUser(ctx.userId, (tx) => tx.selectFrom('organization_members').select(sql<number>`count(*)`.as('n')).where('organization_id', '=', ctx.orgId).executeTakeFirstOrThrow()),
  ])
  const canManage = can(ctx.role, 'license:manage')
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Current plan</CardTitle>
            <CardDescription>{ent.licensed ? `Licensed · key ending …${ent.licenseLast4}${ent.expiresAt ? ` · expires ${formatDate(ent.expiresAt)}` : ' · perpetual'}` : 'No active license — running on the Evaluation plan.'}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={ent.licensed ? 'success' : 'warning'}>{ent.name}</Badge>
            {ent.licensed && canManage ? <DeactivateLicense /> : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <ul className="space-y-1.5">
            {(Object.keys(MODULE_LABELS) as Module[]).map((m) => (
              <li key={m} className="flex items-center gap-2 text-[13px]">
                {ent.modules.includes(m) ? <Check className="size-4 text-success" aria-label="Included" /> : <Minus className="size-4 text-fg-subtle" aria-label="Not included" />}
                <span className={ent.modules.includes(m) ? 'text-fg' : 'text-fg-subtle'}>{MODULE_LABELS[m]}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 text-[13px]">
              {ent.whiteLabel ? <Check className="size-4 text-success" /> : <Minus className="size-4 text-fg-subtle" />}
              <span className={ent.whiteLabel ? 'text-fg' : 'text-fg-subtle'}>White-label deliverables</span>
            </li>
          </ul>
          <div className="space-y-4">
            {[
              ['Team members', Number(members.n), ent.maxMembers],
              ['AI generations this month', usage.aiGenerations, ent.aiGenerationsPerMonth],
              ['Website audits this month', usage.audits, ent.auditsPerMonth],
            ].map(([l, u, max]) => (
              <div key={l as string}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-fg-muted">{l}</span>
                  <span className="tabular-nums">
                    {u} / {max}
                  </span>
                </div>
                <Progress value={((u as number) / (max as number)) * 100} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <ActivateLicense canManage={canManage} licensed={ent.licensed} configured={integrationStatus().licensing} />
      {!ent.licensed || ent.id === 'standard' ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-fg-muted">Need a license or an upgrade? Licenses are one-time purchases. Bank transfer and Enterprise terms are available on request.</p>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href="/pricing">View plans</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/contact?topic=sales">Contact sales</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Activation history</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Plan</TH>
              <TH>Key</TH>
              <TH>Activated</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {history.length === 0 ? (
              <TR>
                <TD colSpan={4} className="py-8 text-center">
                  No licenses have been activated for this organization.
                </TD>
              </TR>
            ) : (
              history.map((h) => (
                <TR key={h.id}>
                  <TD className="capitalize text-fg">{h.plan}</TD>
                  <TD className="font-mono text-xs">…{h.key_last4}</TD>
                  <TD>
                    {formatDate(h.activated_at)}
                    {h.activatedBy ? ` by ${h.activatedBy}` : ''}
                  </TD>
                  <TD>{h.deactivated_at ? <span className="text-xs text-fg-subtle">Deactivated {formatDate(h.deactivated_at)} — {h.deactivated_reason}</span> : <Badge tone={h.status === 'active' ? 'success' : 'danger'}>{h.status}</Badge>}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
      <p className="text-xs leading-relaxed text-fg-subtle">
        The hosted service relies on continued hosting, database and AI API services and is provided under the Terms of Service and the fair-use limits above. Self-hosted deployments are available under separately negotiated Enterprise agreements.
      </p>
    </>
  )
}
