'use client'
import { useState, useTransition } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Notice } from '@/components/ui/states'
import { submitContact } from '@/actions/contact'

export function ContactForm({ initialTopic }: { initialTopic: string }) {
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h2 className="mt-4 text-base font-semibold">Message received</h2>
        <p className="mt-2 max-w-sm text-[13px] text-fg-muted">Your message has been saved and our team will reply to the email address you provided.</p>
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        start(async () => {
          const res = await submitContact(fd)
          if (res.ok) setDone(true)
          else {
            setErrors(res.error.fieldErrors ?? {})
            setFormError(res.error.fieldErrors ? null : res.error.message)
          }
        })
      }}
    >
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errors.name} required>
          <Input id="name" name="name" autoComplete="name" required aria-invalid={!!errors.name} />
        </Field>
        <Field label="Work email" htmlFor="email" error={errors.email} required>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" htmlFor="company" error={errors.company}>
          <Input id="company" name="company" autoComplete="organization" />
        </Field>
        <Field label="Topic" htmlFor="topic">
          <NativeSelect id="topic" name="topic" defaultValue={initialTopic}>
            <option value="sales">Sales & licensing</option>
            <option value="support">Support</option>
            <option value="partnership">Partnership</option>
            <option value="self_hosted">Self-hosted deployment</option>
            <option value="other">Other</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Message" htmlFor="message" error={errors.message} required>
        <Textarea id="message" name="message" rows={6} required aria-invalid={!!errors.message} />
      </Field>
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        Send message
      </Button>
    </form>
  )
}
