'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/menu'
import { Notice } from '@/components/ui/states'
import { toast } from '@/components/ui/toaster'
import { saveProjectAction } from '@/actions/clients'

export type ProjectValues = {
  id: string
  name: string
  client_id: string | null
  description: string | null
  status: string
  deadline: string | null
  budget: number | null
  currency: string
  internal_notes: string | null
  memberIds: string[]
}

type Option = { id: string; name: string }

export function ProjectDialog({ project, clients, members, trigger, defaultOpen }: { project?: ProjectValues; clients: Option[]; members: { userId: string; name: string; role: string }[]; trigger: React.ReactNode; defaultOpen?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>(project?.memberIds ?? [])
  const p = project
  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader title={p ? 'Edit project' : 'New project'} description="Members only see projects they are assigned to." />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              selected.forEach((id) => fd.append('members', id))
              start(async () => {
                const res = await saveProjectAction(p?.id ?? null, fd)
                if (!res.ok) {
                  setErrors(res.error.fieldErrors ?? {})
                  setFormError(res.error.fieldErrors ? null : res.error.message)
                  return
                }
                toast.success(p ? 'Project updated' : 'Project created')
                setOpen(false)
                if (!p) router.push(`/app/projects/${res.data.id}`)
                else router.refresh()
              })
            }}
          >
            <DialogBody>
              {formError ? <Notice tone="danger">{formError}</Notice> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project name" htmlFor="name" error={errors.name} required className="sm:col-span-2">
                  <Input id="name" name="name" defaultValue={p?.name} required maxLength={160} />
                </Field>
                <Field label="Client" htmlFor="clientId" error={errors.clientId}>
                  <NativeSelect id="clientId" name="clientId" defaultValue={p?.client_id ?? ''}>
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Status" htmlFor="status">
                  <NativeSelect id="status" name="status" defaultValue={p?.status ?? 'planning'}>
                    <option value="planning">Planning</option>
                    <option value="in_progress">In progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On hold</option>
                  </NativeSelect>
                </Field>
                <Field label="Deadline" htmlFor="deadline" error={errors.deadline}>
                  <Input id="deadline" name="deadline" type="date" defaultValue={p?.deadline ?? ''} />
                </Field>
                <div className="grid grid-cols-[1fr_88px] gap-2">
                  <Field label="Budget" htmlFor="budget" error={errors.budget}>
                    <Input id="budget" name="budget" type="number" min={0} step="0.01" defaultValue={p?.budget ?? ''} />
                  </Field>
                  <Field label="Currency" htmlFor="currency" error={errors.currency}>
                    <Input id="currency" name="currency" defaultValue={p?.currency ?? 'USD'} maxLength={3} className="uppercase" />
                  </Field>
                </div>
              </div>
              <Field label="Description" htmlFor="description" error={errors.description}>
                <Textarea id="description" name="description" defaultValue={p?.description ?? ''} rows={3} />
              </Field>
              <Field label="Internal notes" htmlFor="internalNotes" error={errors.internalNotes} hint="Visible to your team only.">
                <Textarea id="internalNotes" name="internalNotes" defaultValue={p?.internal_notes ?? ''} rows={3} />
              </Field>
              <fieldset>
                <legend className="text-[13px] font-medium">Team members</legend>
                <div className="mt-2 grid max-h-40 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2 scrollbar-thin">
                  {members.map((m) => (
                    <label key={m.userId} className="flex items-center gap-2 rounded px-1.5 py-1 text-[13px] text-fg-muted hover:bg-hover">
                      <Checkbox checked={selected.includes(m.userId)} onCheckedChange={(c) => setSelected((s) => (c ? [...s, m.userId] : s.filter((x) => x !== m.userId)))} />
                      <span className="truncate">{m.name}</span>
                      <span className="ml-auto text-2xs capitalize text-fg-subtle">{m.role}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {p ? 'Save changes' : 'Create project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
