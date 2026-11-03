import type { Metadata } from 'next'
import { redirectInPreview } from '../preview-redirect'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth-forms'
import { Notice } from '@/components/ui/states'

export const metadata: Metadata = { title: 'Choose a new password' }

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  redirectInPreview()
  const { token, error } = await searchParams
  return (
    <>
      <h1 className="text-lg font-semibold">Choose a new password</h1>
      <div className="mt-6">
        {!token || error ? (
          <>
            <Notice tone="danger">This reset link is invalid or has expired.</Notice>
            <Link href="/forgot-password" className="mt-4 inline-block text-[13px] text-accent">
              Request a new link
            </Link>
          </>
        ) : (
          <ResetPasswordForm token={token} />
        )}
      </div>
    </>
  )
}
