'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Notice } from '@/components/ui/states'
import { createProposalAction } from '@/actions/proposals'
import { cn } from '@/lib/utils'

const TEMPLATES = [
  { id: 'consulting', name: 'Consulting', desc: 'Classic cover page, numbered sections.' },
  { id: 'modern', name: 'Modern', desc: 'Full-color brand cover, bold headings.' },
  { id: 'minimal', name: 'Minimal', desc: 'Clean, typographic, understated.' },
]

export function NewProposalForm({ clients, aiReady }: { clients: { id: string; name: string; company: string | null }[]; aiReady: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [template, setTemplate] = useState('consulting')
  const [clientName, setClientName] = useState('')
  const [clientCompany, setClientCompany] = useState('')
  const [mode, setMode] = useState<'ai' | 'blank'>(aiReady ? 'ai' : 'blank')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        fd.set('template', template)
        fd.set('mode', mode)
        start(async () => {
          const res = await createProposalAction(fd)
          if (!res.ok) {
            setErrors(res.error.fieldErrors ?? {})
            setFormError(res.error.fieldErrors ? 'Please correct the highlighted fields.' : res.error.message)
            return
          }
          router.push(`/app/proposals/${res.data.id}`)
        })
      }}
      className="space-y-6"
    >
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Client</CardTitle>
            <CardDescription>Choose an existing client or enter the details manually.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Existing client" htmlFor="clientId">
            <NativeSelect
              id="clientId"
              name="clientId"
              defaultValue=""
              onChange={(e) => {
                const c = clients.find((x) => x.id === e.target.value)
                if (c) {
                  setClientName(c.name)
                  setClientCompany(c.company ?? '')
                }
              }}
            >
              <option value="">Not linked</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Client name" htmlFor="clientName" error={errors.clientName} required>
            <Input id="clientName" name="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} required maxLength={160} />
          </Field>
          <Field label="Client company" htmlFor="clientCompany" error={errors.clientCompany}>
            <Input id="clientCompany" name="clientCompany" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} maxLength={160} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Project brief</CardTitle>
            <CardDescription>The more specific the brief, the more specific the proposal.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Project title" htmlFor="projectTitle" error={errors.projectTitle} required>
            <Input id="projectTitle" name="projectTitle" required maxLength={200} placeholder="SEO growth program 2027" />
          </Field>
          <Field label="Project description" htmlFor="projectDescription" error={errors.projectDescription} required>
            <Textarea id="projectDescription" name="projectDescription" rows={4} required maxLength={5000} placeholder="What the client wants to achieve, their current situation and constraints." />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Requirements" htmlFor="requirements" error={errors.requirements}>
              <Textarea id="requirements" name="requirements" rows={4} maxLength={5000} />
            </Field>
            <Field label="Services" htmlFor="services" error={errors.services}>
              <Textarea id="services" name="services" rows={4} maxLength={3000} placeholder="Technical SEO, content strategy, link earning…" />
            </Field>
            <Field label="Deliverables" htmlFor="deliverables" error={errors.deliverables}>
              <Textarea id="deliverables" name="deliverables" rows={4} maxLength={3000} />
            </Field>
            <Field label="Additional notes" htmlFor="notes" error={errors.notes}>
              <Textarea id="notes" name="notes" rows={4} maxLength={3000} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_100px_1fr]">
            <Field label="Budget" htmlFor="budget" error={errors.budget} hint="Pricing is split from this amount only.">
              <Input id="budget" name="budget" type="number" min={0} step="0.01" />
            </Field>
            <Field label="Currency" htmlFor="currency" error={errors.currency}>
              <Input id="currency" name="currency" defaultValue="USD" maxLength={3} className="uppercase" />
            </Field>
            <Field label="Timeline" htmlFor="timeline" error={errors.timeline}>
              <Input id="timeline" name="timeline" maxLength={500} placeholder="12 weeks starting January" />
            </Field>
          </div>
          <Field label="Payment terms" htmlFor="paymentTerms" error={errors.paymentTerms}>
            <Input id="paymentTerms" name="paymentTerms" maxLength={1000} placeholder="50% upfront, 50% on completion, net 14" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={template === t.id}
              onClick={() => setTemplate(t.id)}
              className={cn('rounded-lg border p-3 text-left transition-colors', template === t.id ? 'border-accent bg-accent-soft/50' : 'border-border hover:border-border-strong')}
            >
              <div className={cn('mb-3 h-16 rounded border border-border bg-white', t.id === 'modern' && 'bg-accent', t.id === 'consulting' && 'border-t-4 border-t-accent')} aria-hidden />
              <p className="text-[13px] font-medium">{t.name}</p>
              <p className="text-xs text-fg-subtle">{t.desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2" role="radiogroup" aria-label="Drafting mode">
          <button type="button" role="radio" aria-checked={mode === 'ai'} disabled={!aiReady} onClick={() => setMode('ai')} className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] disabled:opacity-50', mode === 'ai' ? 'border-accent text-fg' : 'border-border text-fg-muted')}>
            <Sparkles className="size-4" /> Draft with AI
          </button>
          <button type="button" role="radio" aria-checked={mode === 'blank'} onClick={() => setMode('blank')} className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-[13px]', mode === 'blank' ? 'border-accent text-fg' : 'border-border text-fg-muted')}>
            <FileText className="size-4" /> Start blank
          </button>
        </div>
        <Button type="submit" loading={pending} size="lg">
          {mode === 'ai' ? (pending ? 'Drafting proposal…' : 'Generate proposal') : 'Create draft'}
        </Button>
      </div>
      {!aiReady ? <p className="text-xs text-fg-subtle">AI drafting is unavailable because Gemini is not configured. You can still create and write proposals manually.</p> : null}
    </form>
  )
}
