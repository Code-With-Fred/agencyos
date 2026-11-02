import { env } from '@/lib/env'
import { emailLicenseKey, getStripe, processStripeWebhook } from '@/lib/payments/stripe'
import { errorResponse } from '@/lib/security/origin'
import { AppError } from '@/lib/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Stripe webhook endpoint. The raw body is required for signature verification. */
export async function POST(req: Request) {
  try {
    const secret = env().STRIPE_WEBHOOK_SECRET
    if (!secret) throw new AppError('not_configured', 'Stripe webhook secret is not configured.')
    const payload = await req.text()
    if (payload.length > 1_000_000) throw new AppError('validation', 'Payload too large.')
    const result = await processStripeWebhook({ payload, signature: req.headers.get('stripe-signature'), secret, stripe: getStripe(), onLicenseIssued: emailLicenseKey })
    return Response.json({ received: true, status: result.status })
  } catch (err) {
    if (err instanceof AppError && err.code === 'forbidden') return Response.json({ error: 'invalid signature' }, { status: 400 })
    return errorResponse(err)
  }
}
