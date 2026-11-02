import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth-forms'
import { SetupRequired } from '@/components/ui/states'
import { integrationStatus, env } from '@/lib/env'

export const metadata: Metadata = { title: 'Reset password' }
export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  const emailReady = integrationStatus().email
  const isDev = env().NODE_ENV !== 'production'
  return (
    <>
      <h1 className="text-lg font-semibold">Reset your password</h1>
      <p className="mt-1 text-[13px] text-fg-muted">Enter your account email and we will send you a reset link.</p>
      <div className="mt-6 space-y-4">
        {!emailReady ? (
          <SetupRequired
            title="Email delivery is not configured"
            description={
              isDev
                ? 'Development mode: the reset link will be printed to the server console instead of emailed.'
                : 'Password reset emails cannot be sent until an email provider is configured. Contact your administrator.'
            }
            envVars={['RESEND_API_KEY', 'EMAIL_FROM']}
          />
        ) : null}
        {emailReady || isDev ? <ForgotPasswordForm /> : null}
      </div>
      <p className="mt-6 text-center text-[13px]">
        <Link href="/login" className="text-fg-muted hover:text-fg">
          Back to sign in
        </Link>
      </p>
    </>
  )
}
