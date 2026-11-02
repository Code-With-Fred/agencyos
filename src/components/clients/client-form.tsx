'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Notice } from '@/components/ui/states'
import { toast } from '@/components/ui/toaster'
import { saveClientAction } from '@/actions/clients'

export type ClientValues = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  industry: string | null
  country: string | null
  notes: string | null
  status: string
}

export function ClientDialog({ client, trigger, defaultOpen }: { client?: ClientValues; trigger: React.ReactNode; defaultOpen?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const v = client
  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader title={client ? 'Edit client' : 'Add client'} description="Client details are visible to everyone in your organization." />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              start(async () => {
                const res = await saveClientAction(client?.id ?? null, fd)
                if (!res.ok) {
                  setErrors(res.error.fieldErrors ?? {})
                  setFormError(res.error.fieldErrors ? null : res.error.message)
                  return
                }
                toast.success(client ? 'Client updated' : 'Client added')
                setOpen(false)
                if (!client) router.push(`/app/clients/${res.data.id}`)
                else router.refresh()
              })
            }}
          >
            <DialogBody>
              {formError ? <Notice tone="danger">{formError}</Notice> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact name" htmlFor="name" error={errors.name} required>
                  <Input id="name" name="name" defaultValue={v?.name} required maxLength={160} />
                </Field>
                <Field label="Company" htmlFor="company" error={errors.company}>
                  <Input id="company" name="company" defaultValue={v?.company ?? ''} maxLength={160} />
                </Field>
                <Field label="Email" htmlFor="email" error={errors.email}>
                  <Input id="email" name="email" type="email" defaultValue={v?.email ?? ''} />
                </Field>
                <Field label="Phone" htmlFor="phone" error={errors.phone}>
                  <Input id="phone" name="phone" defaultValue={v?.phone ?? ''} maxLength={40} />
                </Field>
                <Field label="Website" htmlFor="website" error={errors.website}>
                  <Input id="website" name="website" defaultValue={v?.website ?? ''} placeholder="https://client.com" />
                </Field>
                <Field label="Status" htmlFor="status">
                  <NativeSelect id="status" name="status" defaultValue={v?.status ?? 'active'}>
                    <option value="lead">Lead</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </NativeSelect>
                </Field>
                <Field label="Industry" htmlFor="industry" error={errors.industry}>
                  <Input id="industry" name="industry" defaultValue={v?.industry ?? ''} />
                </Field>
                <Field label="Country" htmlFor="country" error={errors.country}>
                  <Input id="country" name="country" defaultValue={v?.country ?? ''} />
                </Field>
              </div>
              <Field label="Notes" htmlFor="notes" error={errors.notes} hint="Internal — never included in client deliverables.">
                <Textarea id="notes" name="notes" defaultValue={v?.notes ?? ''} rows={4} maxLength={10000} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {client ? 'Save changes' : 'Add client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
