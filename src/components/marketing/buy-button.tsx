'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'

/** Starts a Stripe Checkout session for a one-time license purchase. */
export function BuyButton({ plan, variant = 'primary' }: { plan: 'standard' | 'agency'; variant?: 'primary' | 'secondary' }) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      className="w-full"
      variant={variant}
      loading={pending}
      onClick={async () => {
        setPending(true)
        try {
          const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) })
          const body = (await res.json().catch(() => null)) as { url?: string; error?: { message: string } } | null
          if (!res.ok || !body?.url) {
            toast.error(body?.error?.message ?? 'Checkout is currently unavailable.')
            return
          }
          window.location.assign(body.url)
        } catch {
          toast.error('Could not reach the checkout service.')
        } finally {
          setPending(false)
        }
      }}
    >
      Buy license
    </Button>
  )
}
