'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/states'
import { toast } from '@/components/ui/toaster'
import { activateLicenseAction, deactivateLicenseAction } from '@/actions/licensing'

export function ActivateLicense({ canManage, licensed, configured }: { canManage: boolean; licensed: boolean; configured: boolean }) {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            const res = await activateLicenseAction(key)
            if (!res.ok) return setError(res.error.message)
            setError(null)
            setKey('')
            toast.success(`${res.data.plan[0].toUpperCase()}${res.data.plan.slice(1)} license activated`)
            router.refresh()
          })
        }}
      >
        <CardHeader>
          <div>
            <CardTitle>{licensed ? 'Replace license' : 'Activate a license'}</CardTitle>
            <CardDescription>Enter the key you received after purchase or from our sales team. Activation is verified on the server.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!configured ? <Notice tone="warning">Licensing is not configured on this deployment (LICENSE_SECRET missing).</Notice> : null}
          {!canManage ? <Notice>Only organization owners can activate or deactivate licenses.</Notice> : null}
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Field label="License key" htmlFor="license-key">
            <Input id="license-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AGOS-XXXXX-XXXXX-XXXXX-XXXXX" className="font-mono uppercase" autoComplete="off" spellCheck={false} maxLength={40} disabled={!canManage || !configured} required />
          </Field>
        </CardContent>
        <CardFooter>
          <Button type="submit" size="sm" loading={pending} disabled={!canManage || !configured}>
            <KeyRound /> Activate
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export function DeactivateLicense() {
  const router = useRouter()
  return (
    <ConfirmDialog
      title="Deactivate this license?"
      description="The organization returns to the Evaluation plan immediately. You can activate the same key again later if activations remain."
      confirmLabel="Deactivate"
      trigger={
        <Button variant="ghost" size="sm">
          Deactivate
        </Button>
      }
      onConfirm={async () => {
        const res = await deactivateLicenseAction()
        if (!res.ok) return void toast.error(res.error.message)
        toast.success('License deactivated')
        router.refresh()
      }}
    />
  )
}
