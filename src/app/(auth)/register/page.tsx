import type { Metadata } from 'next'
import { redirectInPreview } from '../preview-redirect'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth-forms'

export const metadata: Metadata = { title: 'Create account' }

export const dynamic = 'force-dynamic'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  redirectInPreview()
  const { next } = await searchParams
  return (
    <>
      <h1 className="text-lg font-semibold">Create your account</h1>
      <p className="mt-1 text-[13px] text-fg-muted">You will set up your organization next.</p>
      <div className="mt-6">
        <RegisterForm next={next} />
      </div>
      <p className="mt-6 text-center text-[13px] text-fg-muted">
        Already have an account?{' '}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="text-accent hover:text-accent-hover">
          Sign in
        </Link>
      </p>
    </>
  )
}
