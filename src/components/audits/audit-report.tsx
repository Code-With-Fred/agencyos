import { CheckCircle2, CircleAlert, CircleDashed, Info, MinusCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Notice } from '@/components/ui/states'
import { scoreColor } from '@/components/app/status'
import { ScoreRing } from './score-ring'
import { CATEGORIES, CATEGORY_LABELS, SEVERITY_LABELS, type CategoryScores, type CheckStatus, type Findings, type Issue, type Severity } from '@/lib/audit/types'
import { SCORING_EXPLANATION, scoreLabel } from '@/lib/audit/scoring'
import type { AuditAi } from '@/lib/ai/schemas/audit.schema'
import { formatBytes } from '@/lib/utils'

const SEV_COLOR: Record<Severity, string> = { critical: 'var(--color-sev-critical)', high: 'var(--color-sev-high)', medium: 'var(--color-sev-medium)', low: 'var(--color-sev-low)', info: 'var(--color-sev-info)' }

export function SeverityTag({ severity }: { severity: Severity }) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide" style={{ color: SEV_COLOR[severity] }}>
      <span className="size-1.5 rounded-full" style={{ background: SEV_COLOR[severity] }} aria-hidden />
      {SEVERITY_LABELS[severity]}
    </span>
  )
}

const CHECK_ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="size-3.5 text-success" aria-label="Pass" />,
  fail: <CircleAlert className="size-3.5 text-danger" aria-label="Fail" />,
  warn: <CircleAlert className="size-3.5 text-warning" aria-label="Warning" />,
  info: <Info className="size-3.5 text-info" aria-label="Info" />,
  not_measured: <CircleDashed className="size-3.5 text-fg-subtle" aria-label="Not measured" />,
}

function IssueCard({ issue, ai }: { issue: Issue; ai?: { plain_english: string; recommended_fix: string } }) {
  return (
    <div className="rounded-lg border border-border bg-elevated/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityTag severity={issue.severity} />
        {issue.estimate ? <Badge>Automated estimate</Badge> : null}
        {issue.source === 'pagespeed' ? <Badge tone="info">PageSpeed Insights</Badge> : null}
      </div>
      <h4 className="mt-2 text-[14px] font-semibold text-fg">{issue.title}</h4>
      <dl className="mt-3 space-y-2.5 text-[13px]">
        <div>
          <dt className="text-2xs font-medium uppercase tracking-wider text-fg-subtle">Evidence</dt>
          <dd className="mt-0.5 break-words font-mono text-xs leading-relaxed text-fg-muted">{issue.evidence}</dd>
        </div>
        <div>
          <dt className="text-2xs font-medium uppercase tracking-wider text-fg-subtle">Why it matters</dt>
          <dd className="mt-0.5 leading-relaxed text-fg-muted">{ai?.plain_english || issue.explanation}</dd>
        </div>
        <div>
          <dt className="text-2xs font-medium uppercase tracking-wider text-fg-subtle">Recommended fix</dt>
          <dd className="mt-0.5 leading-relaxed text-fg">{ai?.recommended_fix || issue.recommendation}</dd>
        </div>
      </dl>
    </div>
  )
}

export function AuditReport({ overall, categories, issues, findings, ai, aiStatus, aiError }: { overall: number; categories: CategoryScores; issues: Issue[]; findings: Findings; ai: AuditAi | null; aiStatus: string; aiError: string | null }) {
  const explanations = new Map(ai?.issue_explanations.map((e) => [e.issue_id, e]) ?? [])
  const issuesById = new Map(issues.map((i) => [i.id, i]))
  const counts = (['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map((s) => [s, issues.filter((i) => i.severity === s).length] as const)
  const psi = findings.pagespeed

  return (
    <div className="space-y-6">
      {/* 1-2. Summary & score */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="flex flex-col items-center py-6">
            <ScoreRing score={overall} size={128} />
            <p className="mt-2 text-sm font-medium" style={{ color: scoreColor(overall) }}>
              {scoreLabel(overall)}
            </p>
            <div className="mt-5 w-full space-y-2.5">
              {CATEGORIES.map((c) => (
                <div key={c}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-fg-muted">{CATEGORY_LABELS[c]}</span>
                    <span className="tabular-nums text-fg">{categories[c]}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-elevated">
                    <div className="h-1.5 rounded-full" style={{ width: `${categories[c]}%`, background: scoreColor(categories[c]) }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {counts.map(([s, n]) => (
                <span key={s} className="text-center">
                  <span className="block text-base font-semibold tabular-nums" style={{ color: n ? SEV_COLOR[s] : 'var(--color-fg-subtle)' }}>
                    {n}
                  </span>
                  <span className="text-2xs text-fg-subtle">{SEVERITY_LABELS[s]}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Executive summary</CardTitle>
              <CardDescription>{ai ? 'Written by AI from the measured findings below.' : 'AI analysis'}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {ai ? (
              <div className="space-y-3 text-[14px] leading-relaxed text-fg-muted">
                <p className="text-fg">{ai.executive_summary}</p>
                <p>{ai.overall_assessment}</p>
              </div>
            ) : aiStatus === 'pending' ? (
              <Notice>AI analysis is in progress or was interrupted. Use “Regenerate analysis” if it does not appear.</Notice>
            ) : aiStatus === 'failed' ? (
              <Notice tone="danger">AI analysis failed: {aiError ?? 'unknown error'}. The measured findings below are complete — you can regenerate the analysis.</Notice>
            ) : (
              <Notice tone="warning">AI analysis was skipped because Gemini is not configured. All findings, evidence and recommended fixes below come from automated checks.</Notice>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 8. Priority recommendations */}
      {ai && ai.priority_recommendations.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Priority recommendations</CardTitle>
          </CardHeader>
          <ol className="divide-y divide-border">
            {ai.priority_recommendations.map((r, i) => {
              const issue = issuesById.get(r.issue_id)
              return (
                <li key={r.issue_id} className="flex gap-4 px-5 py-4">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border-strong font-mono text-xs text-fg-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium text-fg">{r.title}</p>
                      {issue ? <SeverityTag severity={issue.severity} /> : null}
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{r.rationale}</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-fg">{r.action}</p>
                    <p className="mt-2 text-2xs text-fg-subtle">
                      Impact: <span className="capitalize">{r.impact}</span> · Effort: <span className="capitalize">{r.effort}</span>
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
      ) : null}

      {/* 3-7. Category sections */}
      {CATEGORIES.map((c) => {
        const list = issues.filter((i) => i.category === c)
        const checks = findings.checks.filter((k) => k.category === c)
        return (
          <Card key={c}>
            <CardHeader>
              <div>
                <CardTitle>{CATEGORY_LABELS[c]}</CardTitle>
                <CardDescription>
                  {list.length ? `${list.length} issue${list.length === 1 ? '' : 's'} found` : 'No issues found'} · score {categories[c]}/100
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {c === 'performance' ? (
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    ['HTML size', formatBytes(findings.fetch.htmlBytes)],
                    ['Transferred', formatBytes(findings.fetch.transferBytes)],
                    ['First byte (1 sample)', `${findings.fetch.ttfbMs} ms`],
                    ['Compression', findings.fetch.contentEncoding ?? 'None'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md border border-border p-3">
                      <p className="text-2xs text-fg-subtle">{k}</p>
                      <p className="mt-1 text-[13px] font-medium tabular-nums text-fg">{v}</p>
                    </div>
                  ))}
                  {psi ? (
                    <div className="rounded-md border border-info/25 bg-info-soft/30 p-3 sm:col-span-4">
                      <p className="text-2xs font-medium text-info">PageSpeed Insights · mobile · {new Date(psi.fetchedAt).toLocaleDateString('en-US')}</p>
                      <p className="mt-1 text-[13px] text-fg-muted">
                        Lab performance score: <span className="font-medium text-fg">{psi.lab.performanceScore ?? '—'}</span>
                        {psi.lab.lcpMs !== null ? ` · LCP ${(psi.lab.lcpMs / 1000).toFixed(1)}s` : ''}
                        {psi.lab.tbtMs !== null ? ` · TBT ${Math.round(psi.lab.tbtMs)}ms` : ''}
                        {psi.lab.cls !== null ? ` · CLS ${psi.lab.cls.toFixed(2)}` : ''}
                        {psi.field.available ? ` · Field data: ${psi.field.overall ?? 'available'}` : ' · No field (CrUX) data available for this URL'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-fg-subtle sm:col-span-4">
                      Core Web Vitals: not measured ({findings.pagespeedStatus === 'failed' ? 'the PageSpeed Insights request failed' : 'PageSpeed Insights is not configured'}). No values are estimated.
                    </p>
                  )}
                </div>
              ) : null}
              {list.length ? <div className="grid gap-3 xl:grid-cols-2">{list.map((i) => <IssueCard key={i.id} issue={i} ai={explanations.get(i.id)} />)}</div> : null}
              <details className="group rounded-md border border-border">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">Checks performed ({checks.length})</summary>
                <ul className="divide-y divide-border border-t border-border">
                  {checks.map((k) => (
                    <li key={k.id} className="flex items-start gap-2 px-3 py-2 text-xs">
                      <span className="mt-0.5">{CHECK_ICON[k.status]}</span>
                      <span className="w-48 shrink-0 text-fg">{k.label}</span>
                      <span className="min-w-0 break-words text-fg-muted">{k.detail}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        )
      })}

      {ai && (ai.opportunities.length || ai.next_steps.length) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-fg-muted">
                {ai.opportunities.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Next steps</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-fg-muted">
                {ai.next_steps.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* 9. Conclusion + methodology */}
      <Card>
        <CardHeader>
          <CardTitle>Conclusion & methodology</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px] leading-relaxed text-fg-muted">
          {ai?.conclusion ? <p className="text-fg">{ai.conclusion}</p> : null}
          <p>
            <span className="font-medium text-fg">How the score is calculated. </span>
            {SCORING_EXPLANATION}
          </p>
          <p className="flex gap-2">
            <MinusCircle className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden />
            The audit analyses the server-rendered HTML of one page plus robots.txt, the XML sitemap, a sample of internal links and images. Content rendered only by JavaScript, color contrast, traffic, rankings and backlinks are not measured. Items labelled “estimate” are automated approximations.
          </p>
          <p className="text-xs text-fg-subtle">
            Audited {findings.fetch.finalUrl} · HTTP {findings.fetch.status} · completed in {(findings.durationMs / 1000).toFixed(1)}s
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
