'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/menu'
import { Notice, SetupRequired } from '@/components/ui/states'
import { toast } from '@/components/ui/toaster'
import { removeLogoAction, updateBrandingAction, uploadLogoAction } from '@/actions/org'

type Props = {
  canEdit: boolean
  whiteLabelAllowed: boolean
  storageReady: boolean
  logoUrl: string | null
  orgName: string
  values: {
    companyName: string
    brandColor: string
    accentColor: string
    contactEmail: string
    contactPhone: string
    contactWebsite: string
    address: string
    reportFooter: string
    reportTitleDefault: string
    whiteLabelEnabled: boolean
  }
}

export function BrandingForm({ canEdit, whiteLabelAllowed, storageReady, logoUrl, orgName, values }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [uploading, startUpload] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [preview, setPreview] = useState(values)
  const [whiteLabel, setWhiteLabel] = useState(values.whiteLabelEnabled && whiteLabelAllowed)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Logo</CardTitle>
              <CardDescription>PNG or JPEG, up to 2 MB. Used on PDF exports and shared reports.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {!storageReady ? (
              <SetupRequired title="File storage is not configured" description="Logo uploads require Supabase Storage." envVars={['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']} />
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-40 items-center justify-center rounded-md border border-dashed border-border-strong bg-elevated">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <img src={logoUrl} alt={`${orgName} logo`} className="max-h-12 max-w-36 object-contain" />
                  ) : (
                    <span className="text-xs text-fg-subtle">No logo</span>
                  )}
                </div>
                {canEdit ? (
                  <div className="flex gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="sr-only"
                      aria-label="Upload logo"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 2 * 1024 * 1024) return void toast.error('Logo must be 2 MB or smaller.')
                        const fd = new FormData()
                        fd.set('logo', file)
                        startUpload(async () => {
                          const res = await uploadLogoAction(fd)
                          if (!res.ok) toast.error(res.error.message)
                          else toast.success('Logo uploaded')
                          if (fileRef.current) fileRef.current.value = ''
                          router.refresh()
                        })
                      }}
                    />
                    <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
                      <ImageUp /> Upload
                    </Button>
                    {logoUrl ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          startUpload(async () => {
                            const res = await removeLogoAction()
                            if (!res.ok) toast.error(res.error.message)
                            router.refresh()
                          })
                        }
                      >
                        <Trash2 /> Remove
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <form
            onChange={(e) => {
              const fd = new FormData(e.currentTarget)
              setPreview((p) => ({ ...p, companyName: String(fd.get('companyName') ?? ''), brandColor: String(fd.get('brandColor') ?? p.brandColor), accentColor: String(fd.get('accentColor') ?? p.accentColor), reportFooter: String(fd.get('reportFooter') ?? ''), reportTitleDefault: String(fd.get('reportTitleDefault') ?? ''), contactEmail: String(fd.get('contactEmail') ?? ''), contactWebsite: String(fd.get('contactWebsite') ?? '') }))
            }}
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              fd.set('whiteLabelEnabled', whiteLabel ? 'true' : 'false')
              start(async () => {
                const res = await updateBrandingAction(fd)
                if (!res.ok) {
                  setErrors(res.error.fieldErrors ?? {})
                  if (!res.error.fieldErrors) toast.error(res.error.message)
                  return
                }
                setErrors({})
                toast.success('Branding saved')
                router.refresh()
              })
            }}
          >
            <CardHeader>
              <div>
                <CardTitle>White-label settings</CardTitle>
                <CardDescription>Applied to report and proposal PDFs, onboarding documents and shared report pages.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <fieldset disabled={!canEdit} className="space-y-4">
                {!canEdit ? <Notice>Only owners and admins can change branding.</Notice> : null}
                <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                  <div>
                    <p className="text-[13px] font-medium">White-label mode</p>
                    <p className="mt-0.5 text-xs text-fg-subtle">{whiteLabelAllowed ? 'Remove all AgencyOS branding from client-facing deliverables.' : 'Available on the Agency and Enterprise plans. Deliverables include a small "Prepared with AgencyOS AI" footer.'}</p>
                  </div>
                  <Switch checked={whiteLabel} onCheckedChange={setWhiteLabel} disabled={!whiteLabelAllowed || !canEdit} aria-label="White-label mode" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company display name" htmlFor="companyName" error={errors.companyName}>
                    <Input id="companyName" name="companyName" defaultValue={values.companyName} maxLength={160} />
                  </Field>
                  <Field label="Default report title" htmlFor="reportTitleDefault" error={errors.reportTitleDefault}>
                    <Input id="reportTitleDefault" name="reportTitleDefault" defaultValue={values.reportTitleDefault} placeholder="Monthly Performance Report" maxLength={200} />
                  </Field>
                  <Field label="Brand color" htmlFor="brandColor" error={errors.brandColor}>
                    <Input id="brandColor" name="brandColor" type="color" defaultValue={values.brandColor} className="h-9 p-1" />
                  </Field>
                  <Field label="Accent color" htmlFor="accentColor" error={errors.accentColor}>
                    <Input id="accentColor" name="accentColor" type="color" defaultValue={values.accentColor} className="h-9 p-1" />
                  </Field>
                  <Field label="Contact email" htmlFor="contactEmail" error={errors.contactEmail}>
                    <Input id="contactEmail" name="contactEmail" type="email" defaultValue={values.contactEmail} />
                  </Field>
                  <Field label="Contact phone" htmlFor="contactPhone" error={errors.contactPhone}>
                    <Input id="contactPhone" name="contactPhone" defaultValue={values.contactPhone} maxLength={40} />
                  </Field>
                  <Field label="Website" htmlFor="contactWebsite" error={errors.contactWebsite} className="sm:col-span-2">
                    <Input id="contactWebsite" name="contactWebsite" defaultValue={values.contactWebsite} />
                  </Field>
                </div>
                <Field label="Address" htmlFor="address" error={errors.address}>
                  <Textarea id="address" name="address" defaultValue={values.address} rows={2} maxLength={500} />
                </Field>
                <Field label="Report footer" htmlFor="reportFooter" error={errors.reportFooter} hint="Shown at the bottom of every page of exported deliverables.">
                  <Input id="reportFooter" name="reportFooter" defaultValue={values.reportFooter} maxLength={500} placeholder="Confidential — prepared for client use only" />
                </Field>
              </fieldset>
            </CardContent>
            {canEdit ? (
              <CardFooter>
                <Button type="submit" size="sm" loading={pending}>
                  Save branding
                </Button>
              </CardFooter>
            ) : null}
          </form>
        </Card>
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <p className="mb-2 text-xs font-medium text-fg-subtle">Preview</p>
        <div className="overflow-hidden rounded-lg border border-border-strong bg-white text-zinc-900">
          <div className="h-1.5" style={{ background: preview.brandColor }} />
          <div className="flex items-center justify-between px-5 py-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
              <img src={logoUrl} alt="" className="max-h-8 max-w-28 object-contain" />
            ) : (
              <span className="text-sm font-semibold">{preview.companyName || orgName}</span>
            )}
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Client report</span>
          </div>
          <div className="px-5 pb-5">
            <p className="text-lg font-semibold" style={{ color: preview.brandColor }}>
              {preview.reportTitleDefault || 'Monthly Performance Report'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Prepared for Example Client · October 2026</p>
            <div className="mt-4 space-y-1.5">
              <div className="h-2 w-full rounded bg-zinc-100" />
              <div className="h-2 w-5/6 rounded bg-zinc-100" />
              <div className="h-2 w-4/6 rounded bg-zinc-100" />
            </div>
            <div className="mt-4 inline-block rounded px-2 py-1 text-[10px] font-medium text-white" style={{ background: preview.accentColor }}>
              Highlight
            </div>
          </div>
          <div className="flex justify-between border-t border-zinc-200 px-5 py-2.5 text-[10px] text-zinc-500">
            <span>{preview.reportFooter || preview.contactWebsite || preview.contactEmail || ' '}</span>
            <span>{whiteLabel ? 'Page 1' : 'Prepared with AgencyOS AI · Page 1'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
