'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/states'
import { toast } from '@/components/ui/toaster'
import { createOrganizationAction, updateOrganizationAction } from '@/actions/org'

type OrgValues = { name: string; website: string | null; industry: string | null; country: string | null; business_email: string | null; brand_color: string }

export function OrganizationForm({ mode, initial, disabled }: { mode: 'create' | 'edit'; initial?: OrgValues; disabled?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        start(async () => {
          const res = mode === 'create' ? await createOrganizationAction(fd) : await updateOrganizationAction(fd)
          if (!res.ok) {
            setErrors(res.error.fieldErrors ?? {})
            setFormError(res.error.fieldErrors ? null : res.error.message)
            return
          }
          setErrors({})
          setFormError(null)
          if (mode === 'create') {
            router.replace('/app')
          } else toast.success('Organization updated')
          router.refresh()
        })
      }}
    >
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <fieldset disabled={disabled} className="space-y-4">
        <Field label="Organization name" htmlFor="name" error={errors.name} required>
          <Input id="name" name="name" defaultValue={initial?.name} required minLength={2} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website" htmlFor="website" error={errors.website}>
            <Input id="website" name="website" defaultValue={initial?.website ?? ''} placeholder="https://youragency.com" />
          </Field>
          <Field label="Business email" htmlFor="businessEmail" error={errors.businessEmail}>
            <Input id="businessEmail" name="businessEmail" type="email" defaultValue={initial?.business_email ?? ''} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Industry" htmlFor="industry" error={errors.industry}>
            <Input id="industry" name="industry" defaultValue={initial?.industry ?? ''} placeholder="SEO agency" />
          </Field>
          <Field label="Country" htmlFor="country" error={errors.country}>
            <Input id="country" name="country" defaultValue={initial?.country ?? ''} />
          </Field>
          <Field label="Brand color" htmlFor="brandColor" error={errors.brandColor}>
            <Input id="brandColor" name="brandColor" type="color" defaultValue={initial?.brand_color ?? '#6D6AF5'} className="h-9 p-1" />
          </Field>
        </div>
      </fieldset>
      {!disabled ? (
        <Button type="submit" loading={pending}>
          {mode === 'create' ? 'Create organization' : 'Save changes'}
        </Button>
      ) : null}
    </form>
  )
}
