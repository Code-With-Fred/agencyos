'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, NativeSelect, Textarea } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/menu'
import { Notice } from '@/components/ui/states'
import { createOnboardingKitAction } from '@/actions/onboarding'
import { ONBOARDING_DOC_TYPES } from '@/lib/ai/schemas/onboarding.schema'

export function NewKitForm({ clients, projects, projectTypes, aiReady }: { clients: { id: string; name: string }[]; projects: { id: string; name: string; clientId: string | null }[]; projectTypes: readonly string[]; aiReady: boolean }) {
  const router = useRouter()
  const [clientId, setClientId] = useState('')
  const [types, setTypes] = useState<string[]>(ONBOARDING_DOC_TYPES.map((d) => d.type))
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Generate onboarding documents</CardTitle>
          <CardDescription>{aiReady ? 'AI drafts each document from the client and project details. Review everything before sharing.' : 'Gemini is not configured — documents are created as blank templates you can write yourself.'}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            start(async () => {
              const res = await createOnboardingKitAction({ clientId: fd.get('clientId'), projectId: fd.get('projectId') || null, projectType: fd.get('projectType'), requirements: fd.get('requirements') ?? '', types })
              if (!res.ok) return setError(res.error.fieldErrors ? Object.values(res.error.fieldErrors)[0]?.[0] ?? res.error.message : res.error.message)
              router.push(`/app/onboarding/${res.data.id}`)
            })
          }}
        >
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {clients.length === 0 ? <Notice tone="warning">Add a client first — onboarding documents are always created for a client.</Notice> : null}
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Client" htmlFor="ok-client" required>
              <NativeSelect id="ok-client" name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Project (optional)" htmlFor="ok-project">
              <NativeSelect id="ok-project" name="projectId" defaultValue="">
                <option value="">None</option>
                {projects
                  .filter((p) => !clientId || p.clientId === clientId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field label="Project type" htmlFor="ok-type" required>
              <NativeSelect id="ok-type" name="projectType" defaultValue={projectTypes[0]}>
                {projectTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Project requirements" htmlFor="ok-req" hint="Goals, scope, constraints, systems involved, key dates.">
            <Textarea id="ok-req" name="requirements" rows={4} maxLength={10000} />
          </Field>
          <fieldset>
            <legend className="text-[13px] font-medium">Documents</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {ONBOARDING_DOC_TYPES.map((d) => (
                <label key={d.type} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px] text-fg-muted hover:border-border-strong">
                  <Checkbox checked={types.includes(d.type)} onCheckedChange={(c) => setTypes((t) => (c ? [...t, d.type] : t.filter((x) => x !== d.type)))} />
                  {d.title}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" loading={pending} disabled={!clients.length || !types.length}>
            {!pending ? <Sparkles /> : null} {pending ? (aiReady ? 'Generating documents…' : 'Creating…') : aiReady ? 'Generate documents' : 'Create templates'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
