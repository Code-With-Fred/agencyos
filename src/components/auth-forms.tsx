'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/auth-client'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Notice } from '@/components/ui/states'
import { safeNext } from '@/lib/safe-redirect'

function useFormState() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return { pending, setPending, error, setError }
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const s = useFormState()
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        s.setPending(true)
        s.setError(null)
        const { error } = await authClient.signIn.email({ email: String(fd.get('email')), password: String(fd.get('password')) })
        s.setPending(false)
        if (error) {
          s.setError(error.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : 'Invalid email or password.')
          return
        }
        router.replace(safeNext(next))
        router.refresh()
      }}
    >
      {s.error ? <Notice tone="danger">{s.error}</Notice> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs text-fg-muted hover:text-fg">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" loading={s.pending}>
        Sign in
      </Button>
    </form>
  )
}

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter()
  const s = useFormState()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const name = String(fd.get('name') ?? '').trim()
        const email = String(fd.get('email') ?? '').trim()
        const password = String(fd.get('password') ?? '')
        const confirm = String(fd.get('confirm') ?? '')
        const errs: Record<string, string> = {}
        if (name.length < 2) errs.name = 'Enter your full name'
        if (password.length < 10) errs.password = 'Use at least 10 characters'
        if (password !== confirm) errs.confirm = 'Passwords do not match'
        setFieldErrors(errs)
        if (Object.keys(errs).length) return
        s.setPending(true)
        s.setError(null)
        const { error } = await authClient.signUp.email({ name, email, password })
        s.setPending(false)
        if (error) {
          s.setError(error.status === 429 ? 'Too many attempts. Please try again later.' : (error.message ?? 'Registration failed.'))
          return
        }
        router.replace(safeNext(next, '/app/setup'))
        router.refresh()
      }}
    >
      {s.error ? <Notice tone="danger">{s.error}</Notice> : null}
      <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
        <Input id="name" name="name" autoComplete="name" required aria-invalid={!!fieldErrors.name} />
      </Field>
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" error={fieldErrors.password} hint="At least 10 characters.">
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={10} maxLength={128} required aria-invalid={!!fieldErrors.password} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={fieldErrors.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required aria-invalid={!!fieldErrors.confirm} />
      </Field>
      <Button type="submit" className="w-full" loading={s.pending}>
        Create account
      </Button>
      <p className="text-center text-xs text-fg-subtle">
        By creating an account you agree to the{' '}
        <Link href="/terms" className="underline hover:text-fg">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-fg">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  )
}

export function ForgotPasswordForm() {
  const s = useFormState()
  const [sent, setSent] = useState(false)
  if (sent) {
    return <Notice tone="success">If an account exists for that email, a password reset link is on its way. The link expires in one hour.</Notice>
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        s.setPending(true)
        s.setError(null)
        const { error } = await authClient.requestPasswordReset({ email: String(fd.get('email')), redirectTo: '/reset-password' })
        s.setPending(false)
        if (error) {
          s.setError(error.status === 429 ? 'Too many requests. Please try again later.' : 'Could not process the request.')
          return
        }
        setSent(true)
      }}
    >
      {s.error ? <Notice tone="danger">{s.error}</Notice> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" className="w-full" loading={s.pending}>
        Send reset link
      </Button>
    </form>
  )
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const s = useFormState()
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const password = String(fd.get('password'))
        if (password.length < 10) return s.setError('Use at least 10 characters.')
        if (password !== String(fd.get('confirm'))) return s.setError('Passwords do not match.')
        s.setPending(true)
        s.setError(null)
        const { error } = await authClient.resetPassword({ newPassword: password, token })
        s.setPending(false)
        if (error) {
          s.setError('This reset link is invalid or has expired. Request a new one.')
          return
        }
        router.replace('/login?reset=1')
      }}
    >
      {s.error ? <Notice tone="danger">{s.error}</Notice> : null}
      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={10} maxLength={128} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" loading={s.pending}>
        Update password
      </Button>
    </form>
  )
}
