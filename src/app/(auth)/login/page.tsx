import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth-forms'
import { Notice } from '@/components/ui/states'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams
  return (
    <>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="mt-1 text-[13px] text-fg-muted">Welcome back to your workspace.</p>
      {reset ? <Notice tone="success" className="mt-4">Password updated. Sign in with your new password.</Notice> : null}
      <div className="mt-6">
        <LoginForm next={next} />
      </div>
      <p className="mt-6 text-center text-[13px] text-fg-muted">
        New to AgencyOS?{' '}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="text-accent hover:text-accent-hover">
          Create an account
        </Link>
      </p>
    </>
  )
}
