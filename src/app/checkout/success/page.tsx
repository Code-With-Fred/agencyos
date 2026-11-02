import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Clock } from 'lucide-react'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/states'
import { CopyField } from '@/components/admin/copy-field'
import { getCheckoutResult } from '@/lib/payments/stripe'
import { AppError } from '@/lib/errors'

export const metadata: Metadata = { title: 'Purchase complete', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams
  let result: Awaited<ReturnType<typeof getCheckoutResult>> | { state: 'unavailable' }
  try {
    result = session_id ? await getCheckoutResult(session_id) : { state: 'invalid' }
  } catch (e) {
    if (!(e instanceof AppError)) console.error('[checkout] success page error')
    result = { state: 'unavailable' }
  }
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Logo />
      <div className="mt-8 w-full max-w-lg rounded-xl border border-border-strong bg-surface p-7">
        {result.state === 'issued' ? (
          <>
            <CheckCircle2 className="size-7 text-success" aria-hidden />
            <h1 className="mt-4 text-lg font-semibold">Payment confirmed — here is your license</h1>
            <p className="mt-1 text-[13px] text-fg-muted">
              Plan: <span className="capitalize text-fg">{result.plan}</span>. A copy was sent to {result.email} if email delivery is configured. Keep this key safe.
            </p>
            <div className="mt-5">
              <CopyField value={result.key} label="License key" />
            </div>
            <p className="mt-4 text-[13px] text-fg-muted">Activate it as an organization owner under Settings → License.</p>
            <Button asChild className="mt-6 w-full">
              <Link href="/app/settings/license">Activate license</Link>
            </Button>
          </>
        ) : result.state === 'processing' || result.state === 'pending_payment' ? (
          <>
            <Clock className="size-7 text-warning" aria-hidden />
            <h1 className="mt-4 text-lg font-semibold">{result.state === 'pending_payment' ? 'Waiting for payment confirmation' : 'Payment received — issuing your license'}</h1>
            <p className="mt-2 text-[13px] text-fg-muted">
              {result.state === 'pending_payment' ? 'Your payment method needs a little longer to confirm. Your license is issued automatically once Stripe confirms the payment.' : 'This usually takes a few seconds. Refresh this page shortly.'}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">We could not find that purchase</h1>
            <Notice tone="warning" className="mt-4">
              {result.state === 'unavailable' ? 'Checkout is not configured on this deployment.' : 'The checkout session is invalid or does not belong to an AgencyOS license purchase.'} If you were charged, contact support with your receipt.
            </Notice>
            <Button asChild variant="secondary" className="mt-6">
              <Link href="/contact?topic=support">Contact support</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
