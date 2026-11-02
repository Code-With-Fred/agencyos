'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, NativeSelect } from '@/components/ui/input'
import { Notice } from '@/components/ui/states'
import { createReportAction } from '@/actions/reports'

type Audit = { id: string; url: string; client_id: string | null; created_at: string; overall_score: number | null }

export function NewReportDialog({ clients, audits, defaultTitle, defaultOpen }: { clients: { id: string; name: string }[]; audits: Audit[]; defaultTitle: string; defaultOpen?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const [clientId, setClientId] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const clientAudits = audits.filter((a) => !clientId || a.client_id === clientId)
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New report
      </Button>
      <DialogContent size="lg">
        <DialogHeader title="Create a client report" description="Combine audit results, project progress and metrics you have verified." />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            start(async () => {
              const res = await createReportAction(fd)
              if (!res.ok) return setError(res.error.message)
              router.push(`/app/reports/${res.data.id}`)
            })
          }}
        >
          <DialogBody>
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client" htmlFor="r-client">
                <NativeSelect id="r-client" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">No client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Template" htmlFor="r-template">
                <NativeSelect id="r-template" name="template" defaultValue="executive">
                  <option value="executive">Executive (single page header)</option>
                  <option value="detailed">Detailed (with cover page)</option>
                </NativeSelect>
              </Field>
              <Field label="Report title" htmlFor="r-title" className="sm:col-span-2">
                <Input id="r-title" name="title" defaultValue={defaultTitle} required maxLength={200} />
              </Field>
              <Field label="Period start" htmlFor="r-start">
                <Input id="r-start" name="periodStart" type="date" defaultValue={first} />
              </Field>
              <Field label="Period end" htmlFor="r-end">
                <Input id="r-end" name="periodEnd" type="date" defaultValue={last} />
              </Field>
              <Field label="Include website audit" htmlFor="r-audit" className="sm:col-span-2" hint={clientAudits.length ? undefined : 'No completed audits for this client yet.'}>
                <NativeSelect id="r-audit" name="auditId" defaultValue="">
                  <option value="">None</option>
                  {clientAudits.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.url.replace(/^https?:\/\//, '')} — {a.overall_score ?? '—'}/100 · {new Date(a.created_at).toLocaleDateString('en-US')}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
