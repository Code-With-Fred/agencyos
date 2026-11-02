'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Copy, Download, Link2, Plus, RefreshCcw, Save, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Checkbox, Switch } from '@/components/ui/menu'
import { Notice } from '@/components/ui/states'
import { toast } from '@/components/ui/toaster'
import {
  addCustomSectionAction,
  createShareLinkAction,
  deleteCustomSectionAction,
  deleteReportAction,
  generateReportSummaryAction,
  moveReportSectionAction,
  refreshReportDataAction,
  revokeShareLinkAction,
  updateMetricsAction,
  updateReportMetaAction,
  updateReportSectionAction,
} from '@/actions/reports'
import { formatDateTime } from '@/lib/utils'

type Section = { id: string; kind: string; title: string; content: string; enabled: boolean; ai_generated: boolean }
type Metric = { label: string; value: string; previous: string; unit: string; source: string; note: string; verified: boolean }
type Share = { id: string; expires_at: string | null; revoked_at: string | null; view_count: number; last_viewed_at: string | null; created_at: string }

const KIND_HINT: Record<string, string> = {
  summary: 'Generated from the data in this report. Edit freely.',
  audit: 'Built from the linked audit’s measured results.',
  projects: 'Built from this client’s projects and task completion.',
  metrics: 'The metric cards below are shown above this text.',
  updates: 'Describe the work completed this period.',
  next_steps: 'Planned actions for the next period.',
  custom: 'Custom section.',
}

function SectionCard({ reportId, section, first, last, canEdit }: { reportId: string; section: Section; first: boolean; last: boolean; canEdit: boolean }) {
  const router = useRouter()
  const [title, setTitle] = useState(section.title)
  const [content, setContent] = useState(section.content)
  const [enabled, setEnabled] = useState(section.enabled)
  const [pending, start] = useTransition()
  const dirty = title !== section.title || content !== section.content || enabled !== section.enabled
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, msg?: string) =>
    start(async () => {
      const res = await fn()
      if (!res.ok) return void toast.error(res.error?.message ?? 'Failed')
      if (msg) toast.success(msg)
      router.refresh()
    })
  return (
    <Card className={enabled ? '' : 'opacity-60'}>
      <CardHeader>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} readOnly={!canEdit} aria-label="Section title" className="h-8 max-w-sm border-transparent bg-transparent px-0 text-sm font-semibold hover:border-border-strong focus-visible:px-2" maxLength={160} />
            {section.ai_generated && !dirty ? <Badge tone="accent">AI draft</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-fg-subtle">{KIND_HINT[section.kind]}</p>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-1">
            <label className="mr-2 flex items-center gap-2 text-xs text-fg-muted">
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Include section" /> Include
            </label>
            <Button variant="ghost" size="icon-sm" disabled={first || pending} aria-label="Move up" onClick={() => run(() => moveReportSectionAction(reportId, section.id, 'up'))}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={last || pending} aria-label="Move down" onClick={() => run(() => moveReportSectionAction(reportId, section.id, 'down'))}>
              <ArrowDown />
            </Button>
            {section.kind === 'custom' ? (
              <Button variant="ghost" size="icon-sm" aria-label="Delete section" onClick={() => run(() => deleteCustomSectionAction(reportId, section.id), 'Section deleted')}>
                <Trash2 />
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} readOnly={!canEdit} rows={Math.min(20, Math.max(4, content.split('\n').length + 1))} aria-label={`${title} content`} maxLength={30000} placeholder={canEdit ? 'Write this section. Use "- " for bullets and "## " for sub-headings.' : ''} />
      </CardContent>
      {canEdit && dirty ? (
        <CardFooter>
          <Button size="sm" loading={pending} onClick={() => run(() => updateReportSectionAction(reportId, section.id, { title, content, enabled }), 'Section saved')}>
            <Save /> Save section
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

function MetricsEditor({ reportId, initial, canEdit }: { reportId: string; initial: Metric[]; canEdit: boolean }) {
  const router = useRouter()
  const [rows, setRows] = useState<Metric[]>(initial)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const set = (i: number, patch: Partial<Metric>) => setRows((r) => r.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Verified metrics</CardTitle>
          <CardDescription>Enter figures you have checked yourself (e.g. from Google Analytics or Search Console) with their source. AgencyOS never invents traffic or ranking data.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {rows.length === 0 ? <p className="text-[13px] text-fg-muted">No metrics yet.</p> : null}
        {rows.map((m, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-6">
            <Input aria-label="Metric" placeholder="Organic sessions" value={m.label} onChange={(e) => set(i, { label: e.target.value })} readOnly={!canEdit} className="md:col-span-2" maxLength={120} />
            <Input aria-label="Value" placeholder="12,480" value={m.value} onChange={(e) => set(i, { value: e.target.value })} readOnly={!canEdit} maxLength={60} />
            <Input aria-label="Previous value" placeholder="Previous" value={m.previous} onChange={(e) => set(i, { previous: e.target.value })} readOnly={!canEdit} maxLength={60} />
            <Input aria-label="Unit" placeholder="Unit" value={m.unit} onChange={(e) => set(i, { unit: e.target.value })} readOnly={!canEdit} maxLength={20} />
            <Input aria-label="Source" placeholder="Source (e.g. GA4)" value={m.source} onChange={(e) => set(i, { source: e.target.value })} readOnly={!canEdit} maxLength={120} />
            <Input aria-label="Note" placeholder="Note (optional)" value={m.note} onChange={(e) => set(i, { note: e.target.value })} readOnly={!canEdit} className="md:col-span-4" maxLength={300} />
            <label className="flex items-center gap-2 text-xs text-fg-muted md:col-span-1">
              <Checkbox checked={m.verified} disabled={!canEdit} onCheckedChange={(c) => set(i, { verified: c === true })} /> I verified this
            </label>
            {canEdit ? (
              <Button variant="ghost" size="sm" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                <Trash2 /> Remove
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
      {canEdit ? (
        <CardFooter className="justify-between">
          <Button variant="ghost" size="sm" onClick={() => setRows((r) => [...r, { label: '', value: '', previous: '', unit: '', source: '', note: '', verified: false }])}>
            <Plus /> Add metric
          </Button>
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await updateMetricsAction(reportId, rows)
                if (!res.ok) return setError(res.error.fieldErrors ? 'Each metric needs a name, value and source, and must be marked as verified.' : res.error.message)
                setError(null)
                toast.success('Metrics saved')
                router.refresh()
              })
            }
          >
            <Save /> Save metrics
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

function SharePanel({ reportId, shares, canShare }: { reportId: string; shares: Share[]; canShare: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState('30')
  const [url, setUrl] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const active = shares.filter((s) => !s.revoked_at && (!s.expires_at || new Date(s.expires_at) > new Date()))
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Share links</CardTitle>
          <CardDescription>Random, revocable links. Viewers see only the enabled sections of this report.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {active.length === 0 ? <p className="text-[13px] text-fg-muted">No active links.</p> : null}
        {active.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
            <div>
              <p className="text-fg">Created {formatDateTime(s.created_at)}</p>
              <p className="text-fg-subtle">
                {s.expires_at ? `Expires ${formatDateTime(s.expires_at)}` : 'No expiry'} · {s.view_count} views
              </p>
            </div>
            {canShare ? (
              <ConfirmDialog
                title="Revoke this link?"
                description="Anyone with the link will immediately lose access."
                confirmLabel="Revoke"
                trigger={
                  <Button variant="ghost" size="sm">
                    Revoke
                  </Button>
                }
                onConfirm={async () => {
                  const res = await revokeShareLinkAction(reportId, s.id)
                  if (!res.ok) return void toast.error(res.error.message)
                  toast.success('Link revoked')
                  router.refresh()
                }}
              />
            ) : null}
          </div>
        ))}
      </CardContent>
      {canShare ? (
        <CardFooter>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Link2 /> Create link
          </Button>
        </CardFooter>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setUrl(null)
        }}
      >
        <DialogContent>
          <DialogHeader title="Create a share link" description="The link is shown once. Store it somewhere safe or create a new one later." />
          <DialogBody>
            {url ? (
              <div className="flex gap-2">
                <Input readOnly value={url} className="font-mono text-xs" aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(url)
                    toast.success('Link copied')
                  }}
                >
                  <Copy /> Copy
                </Button>
              </div>
            ) : (
              <Field label="Expires" htmlFor="share-days">
                <NativeSelect id="share-days" value={days} onChange={(e) => setDays(e.target.value)}>
                  <option value="7">After 7 days</option>
                  <option value="30">After 30 days</option>
                  <option value="90">After 90 days</option>
                  <option value="0">Never (revoke manually)</option>
                </NativeSelect>
              </Field>
            )}
          </DialogBody>
          <DialogFooter>
            {url ? (
              <Button onClick={() => setOpen(false)}>Done</Button>
            ) : (
              <Button
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const res = await createShareLinkAction(reportId, Number(days))
                    if (!res.ok) return void toast.error(res.error.message)
                    setUrl(res.data.url)
                    router.refresh()
                  })
                }
              >
                Create link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function ReportEditor({
  report,
  sections,
  shares,
  audits,
  canEdit,
  canShare,
  aiReady,
}: {
  report: { id: string; title: string; template: string; status: string; period_start: string | null; period_end: string | null; audit_id: string | null; metrics: Metric[] }
  sections: Section[]
  shares: Share[]
  audits: { id: string; url: string; overall_score: number | null; created_at: string }[]
  canEdit: boolean
  canShare: boolean
  aiReady: boolean
}) {
  const router = useRouter()
  const [ai, startAi] = useTransition()
  const [meta, startMeta] = useTransition()
  const [refresh, startRefresh] = useTransition()
  const [newSection, setNewSection] = useState('')
  const [adding, startAdd] = useTransition()

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {canEdit ? (
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 py-3">
              <Button
                size="sm"
                disabled={!aiReady}
                loading={ai}
                onClick={() =>
                  startAi(async () => {
                    const res = await generateReportSummaryAction(report.id)
                    if (!res.ok) return void toast.error(res.error.message)
                    toast.success('Executive summary generated')
                    router.refresh()
                  })
                }
              >
                {!ai ? <Sparkles /> : null} {ai ? 'Generating…' : 'Generate AI summary'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={refresh}
                onClick={() =>
                  startRefresh(async () => {
                    const res = await refreshReportDataAction(report.id)
                    if (!res.ok) return void toast.error(res.error.message)
                    toast.success('Audit and project data refreshed')
                    router.refresh()
                  })
                }
              >
                <RefreshCcw /> Refresh data
              </Button>
              {!aiReady ? <span className="text-xs text-fg-subtle">AI summary unavailable — Gemini is not configured.</span> : <span className="text-xs text-fg-subtle">Save metrics and updates first; the summary uses them.</span>}
            </CardContent>
          </Card>
        ) : null}
        {sections.map((s, i) => (
          <div key={`${s.id}-${s.content.length}-${s.title}`} className="space-y-4">
            <SectionCard reportId={report.id} section={s} first={i === 0} last={i === sections.length - 1} canEdit={canEdit} />
            {s.kind === 'metrics' ? <MetricsEditor reportId={report.id} initial={report.metrics} canEdit={canEdit} /> : null}
          </div>
        ))}
        {canEdit ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              startAdd(async () => {
                const res = await addCustomSectionAction(report.id, newSection)
                if (!res.ok) return void toast.error(res.error.message)
                setNewSection('')
                router.refresh()
              })
            }}
          >
            <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="New section title" aria-label="New section title" required maxLength={160} />
            <Button type="submit" variant="secondary" loading={adding}>
              <Plus /> Add section
            </Button>
          </form>
        ) : null}
      </div>
      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardContent className="grid gap-2 py-4">
            <Button asChild variant="secondary" size="sm">
              <a href={`/api/pdf/report/${report.id}`} download>
                <Download /> Export branded PDF
              </a>
            </Button>
          </CardContent>
        </Card>
        <SharePanel reportId={report.id} shares={shares} canShare={canShare} />
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              startMeta(async () => {
                const res = await updateReportMetaAction(report.id, fd)
                if (!res.ok) return void toast.error(res.error.message)
                toast.success('Report details saved')
                router.refresh()
              })
            }}
          >
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset disabled={!canEdit} className="space-y-3">
                <Field label="Title" htmlFor="rm-title">
                  <Input id="rm-title" name="title" defaultValue={report.title} required maxLength={200} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Status" htmlFor="rm-status">
                    <NativeSelect id="rm-status" name="status" defaultValue={report.status}>
                      <option value="draft">Draft</option>
                      <option value="final">Final</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Template" htmlFor="rm-template">
                    <NativeSelect id="rm-template" name="template" defaultValue={report.template}>
                      <option value="executive">Executive</option>
                      <option value="detailed">Detailed</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Period start" htmlFor="rm-start">
                    <Input id="rm-start" name="periodStart" type="date" defaultValue={report.period_start ?? ''} />
                  </Field>
                  <Field label="Period end" htmlFor="rm-end">
                    <Input id="rm-end" name="periodEnd" type="date" defaultValue={report.period_end ?? ''} />
                  </Field>
                </div>
                <Field label="Website audit" htmlFor="rm-audit">
                  <NativeSelect id="rm-audit" name="auditId" defaultValue={report.audit_id ?? ''}>
                    <option value="">None</option>
                    {audits.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.url.replace(/^https?:\/\//, '')} — {a.overall_score ?? '—'}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </fieldset>
            </CardContent>
            {canEdit ? (
              <CardFooter className="justify-between">
                <ConfirmDialog
                  title="Delete this report?"
                  description="The report, its sections and all share links will be permanently deleted."
                  confirmLabel="Delete"
                  trigger={
                    <Button type="button" variant="ghost" size="sm">
                      <Trash2 /> Delete
                    </Button>
                  }
                  onConfirm={async () => {
                    const res = await deleteReportAction(report.id)
                    if (!res.ok) return void toast.error(res.error.message)
                    toast.success('Report deleted')
                    router.push('/app/reports')
                  }}
                />
                <Button type="submit" size="sm" loading={meta}>
                  Save
                </Button>
              </CardFooter>
            ) : null}
          </form>
        </Card>
      </div>
    </div>
  )
}
