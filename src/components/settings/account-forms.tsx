'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/states'
import { toast } from '@/components/ui/toaster'
import { deleteOrganizationAction } from '@/actions/org'

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <Card>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const value = String(new FormData(e.currentTarget).get('name') ?? '').trim()
          if (value.length < 2 || value.length > 120) return void toast.error('Name must be 2–120 characters.')
          setPending(true)
          const { error } = await authClient.updateUser({ name: value })
          setPending(false)
          if (error) return void toast.error('Could not update your profile.')
          toast.success('Profile updated')
          router.refresh()
        }}
      >
        <CardHeader>
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your name appears on activity, proposals and reports you prepare.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name">
            <Input id="name" name="name" defaultValue={name} required minLength={2} maxLength={120} />
          </Field>
          <Field label="Email" htmlFor="email" hint="Contact support to change your sign-in email.">
            <Input id="email" value={email} disabled readOnly />
          </Field>
        </CardContent>
        <CardFooter>
          <Button type="submit" size="sm" loading={pending}>
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Card>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const form = e.currentTarget
          const fd = new FormData(form)
          const current = String(fd.get('current'))
          const next = String(fd.get('next'))
          if (next.length < 10) return setError('Use at least 10 characters for the new password.')
          if (next !== String(fd.get('confirm'))) return setError('New passwords do not match.')
          setPending(true)
          setError(null)
          const { error: err } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true })
          setPending(false)
          if (err) return setError(err.status === 429 ? 'Too many attempts. Try again later.' : 'Your current password is incorrect.')
          form.reset()
          toast.success('Password changed. Other sessions were signed out.')
        }}
      >
        <CardHeader>
          <div>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Changing your password signs out all other sessions.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Field label="Current password" htmlFor="current">
            <Input id="current" name="current" type="password" autoComplete="current-password" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" htmlFor="next" hint="At least 10 characters.">
              <Input id="next" name="next" type="password" autoComplete="new-password" minLength={10} maxLength={128} required />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm">
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
            </Field>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" size="sm" loading={pending}>
            Update password
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export function RevokeSessionsButton() {
  const router = useRouter()
  return (
    <ConfirmDialog
      title="Sign out other sessions?"
      description="All devices except this one will be signed out immediately."
      confirmLabel="Sign out others"
      destructive={false}
      trigger={
        <Button variant="secondary" size="sm">
          Sign out other sessions
        </Button>
      }
      onConfirm={async () => {
        const { error } = await authClient.revokeOtherSessions()
        if (error) return void toast.error('Could not revoke sessions.')
        toast.success('Other sessions signed out')
        router.refresh()
      }}
    />
  )
}

export function DeleteOrganization({ name }: { name: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState('')
  return (
    <Card className="border-danger/30">
      <CardHeader>
        <div>
          <CardTitle>Delete organization</CardTitle>
          <CardDescription>Permanently deletes this organization and all of its clients, projects, audits, proposals, reports and documents. This cannot be undone.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Field label={`Type "${name}" to confirm`} htmlFor="confirm-delete">
          <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
      </CardContent>
      <CardFooter>
        <ConfirmDialog
          title="Delete this organization permanently?"
          description="Every record that belongs to this organization will be deleted for all members."
          confirmLabel="Delete organization"
          trigger={
            <Button variant="danger" size="sm" disabled={confirm.trim() !== name.trim()}>
              Delete organization
            </Button>
          }
          onConfirm={async () => {
            const res = await deleteOrganizationAction(confirm)
            if (!res.ok) return void toast.error(res.error.message)
            toast.success('Organization deleted')
            router.replace('/app')
            router.refresh()
          }}
        />
      </CardFooter>
    </Card>
  )
}
