import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-xs text-fg-subtle">404</p>
      <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-[13px] text-fg-muted">The page you are looking for does not exist, or you do not have access to it.</p>
      <Button asChild variant="secondary" className="mt-6">
        <Link href="/app">Go to dashboard</Link>
      </Button>
    </div>
  )
}
