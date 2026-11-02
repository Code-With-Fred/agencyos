import type { Metadata } from 'next'
import { sql } from 'kysely'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/page'
import { SetupRequired } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { requireOrgContext } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import { env, integrationStatus } from '@/lib/env'
import { getEntitlements, monthlyUsage } from '@/lib/licensing/entitlements'
import { PROMPT_VERSIONS } from '@/lib/ai/prompts/versions'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'AI configuration' }

const FEATURE_LABELS: Record<string, string> = { audit: 'Website audit analysis', proposal: 'Proposal generation', proposal_section: 'Proposal section regeneration', report: 'Report summaries', onboarding: 'Onboarding documents' }

export default async function AiSettingsPage() {
  const ctx = await requireOrgContext()
  const ent = await getEntitlements(ctx.orgId)
  const configured = integrationStatus().gemini
  const { byFeature, recent, usage } = await withUser(ctx.userId, async (tx) => {
    const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    const [byFeature, recent, usage] = await Promise.all([
      tx
        .selectFrom('ai_usage_logs')
        .select(['feature', sql<number>`count(*) filter (where status = 'success')`.as('ok'), sql<number>`count(*) filter (where status = 'error')`.as('errors'), sql<number>`coalesce(sum(total_tokens), 0)`.as('tokens'), sql<number>`coalesce(avg(latency_ms), 0)`.as('latency')])
        .where('organization_id', '=', ctx.orgId)
        .where('created_at', '>=', since)
        .groupBy('feature')
        .execute(),
      tx
        .selectFrom('ai_usage_logs as l')
        .leftJoin('user as u', 'u.id', 'l.user_id')
        .select(['l.id', 'l.feature', 'l.model', 'l.prompt_version', 'l.status', 'l.error_code', 'l.total_tokens', 'l.latency_ms', 'l.created_at', 'u.name as userName'])
        .where('l.organization_id', '=', ctx.orgId)
        .orderBy('l.created_at', 'desc')
        .limit(20)
        .execute(),
      monthlyUsage(tx, ctx.orgId),
    ])
    return { byFeature, recent, usage }
  })

  return (
    <>
      {!configured ? (
        <SetupRequired title="Gemini is not configured" description="AI generation is unavailable until a Google Gemini API key is set on the server. Measured audit findings still work without AI." envVars={['GEMINI_API_KEY', 'GEMINI_MODEL (optional)']} />
      ) : null}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Model & limits</CardTitle>
            <CardDescription>AI explains and drafts; deterministic code produces every measurement.</CardDescription>
          </div>
          <Badge tone={configured ? 'success' : 'warning'}>{configured ? 'Connected' : 'Not configured'}</Badge>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <dl className="space-y-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-fg-subtle">Provider</dt>
              <dd>Google Gemini API</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-subtle">Model</dt>
              <dd className="font-mono text-xs">{env().GEMINI_MODEL}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-subtle">Request timeout</dt>
              <dd>{Math.round(env().GEMINI_TIMEOUT_MS / 1000)}s, up to 3 attempts</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-subtle">Output validation</dt>
              <dd>Structured JSON + Zod schemas</dd>
            </div>
          </dl>
          <div>
            <div className="mb-2 flex justify-between text-[13px]">
              <span className="text-fg-muted">AI generations this month</span>
              <span className="tabular-nums">
                {usage.aiGenerations} / {ent.aiGenerationsPerMonth}
              </span>
            </div>
            <Progress value={(usage.aiGenerations / ent.aiGenerationsPerMonth) * 100} />
            <p className="mt-2 text-xs text-fg-subtle">Limit resets on the 1st of each month (UTC). Failed requests do not count toward the limit.</p>
            <div className="mt-4">
              <p className="mb-1.5 text-xs text-fg-subtle">Prompt versions</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PROMPT_VERSIONS).map(([k, v]) => (
                  <code key={k} className="rounded border border-border-strong px-1.5 py-0.5 font-mono text-2xs text-fg-muted">
                    {k}@{v}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Usage by feature (this month)</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Feature</TH>
              <TH>Successful</TH>
              <TH>Errors</TH>
              <TH>Tokens</TH>
              <TH>Avg latency</TH>
            </TR>
          </THead>
          <TBody>
            {byFeature.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-8 text-center">
                  No AI usage this month.
                </TD>
              </TR>
            ) : (
              byFeature.map((f) => (
                <TR key={f.feature}>
                  <TD className="text-fg">{FEATURE_LABELS[f.feature] ?? f.feature}</TD>
                  <TD className="tabular-nums">{Number(f.ok)}</TD>
                  <TD className="tabular-nums">{Number(f.errors)}</TD>
                  <TD className="tabular-nums">{Number(f.tokens).toLocaleString('en-US')}</TD>
                  <TD className="tabular-nums">{(Number(f.latency) / 1000).toFixed(1)}s</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent requests</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Time</TH>
              <TH>Feature</TH>
              <TH>User</TH>
              <TH>Status</TH>
              <TH>Tokens</TH>
            </TR>
          </THead>
          <TBody>
            {recent.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</TD>
                <TD>
                  {FEATURE_LABELS[r.feature] ?? r.feature} <span className="font-mono text-2xs text-fg-subtle">{r.prompt_version}</span>
                </TD>
                <TD>{r.userName ?? '—'}</TD>
                <TD>{r.status === 'success' ? <Badge tone="success">Success</Badge> : <Badge tone="danger">{r.error_code ?? 'Error'}</Badge>}</TD>
                <TD className="tabular-nums">{r.total_tokens.toLocaleString('en-US')}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  )
}
