import 'server-only'
import Stripe from 'stripe'
import { env, appUrl } from '@/lib/env'
import { AppError } from '@/lib/errors'
import { withSystem } from '@/lib/db'
import { isPurchasablePlan, PLANS } from '@/lib/licensing/plans'
import { issueLicense } from '@/lib/licensing/service'
import { isEmailConfigured, layoutEmail, sendEmail, escapeHtml } from '@/lib/email/send'

let client: Stripe | null = null
export function getStripe(): Stripe {
  const key = env().STRIPE_SECRET_KEY
  if (!key) throw new AppError('not_configured', 'Online checkout is not configured yet. Contact sales to purchase a license.')
  client ??= new Stripe(key, { appInfo: { name: 'AgencyOS AI' }, maxNetworkRetries: 2, timeout: 20000 })
  return client
}

function priceFor(plan: 'standard' | 'agency'): string {
  const e = env()
  const price = plan === 'standard' ? e.STRIPE_PRICE_STANDARD : e.STRIPE_PRICE_AGENCY
  if (!price) throw new AppError('not_configured', 'Online checkout is not configured for this plan. Contact sales.')
  return price
}

/** One-time payment Checkout Session. The plan is stored in server-set metadata. */
export async function createCheckoutSession(plan: string, customerEmail?: string | null): Promise<string> {
  if (!isPurchasablePlan(plan)) throw new AppError('validation', 'This plan cannot be purchased online.')
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceFor(plan), quantity: 1 }],
    customer_email: customerEmail ?? undefined,
    customer_creation: 'always',
    billing_address_collection: 'required',
    allow_promotion_codes: true,
    metadata: { plan, product: 'agencyos_license' },
    payment_intent_data: { metadata: { plan, product: 'agencyos_license' } },
    success_url: `${appUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
  })
  if (!session.url) throw new AppError('upstream_failed', 'Stripe did not return a checkout URL.')
  return session.url
}

export type WebhookOutcome = { status: 'processed' | 'duplicate' | 'ignored'; licenseId?: string }

/**
 * Verifies the Stripe signature, records the event id for idempotency and
 * issues a license only for confirmed payments of our own product.
 */
export async function processStripeWebhook(opts: { payload: string; signature: string | null; secret: string; stripe: Stripe; onLicenseIssued?: (info: { email: string; key: string; plan: string }) => Promise<void> }): Promise<WebhookOutcome> {
  if (!opts.signature) throw new AppError('validation', 'Missing Stripe-Signature header.')
  let event: Stripe.Event
  try {
    event = opts.stripe.webhooks.constructEvent(opts.payload, opts.signature, opts.secret)
  } catch {
    throw new AppError('forbidden', 'Invalid Stripe webhook signature.')
  }

  return withSystem(async (tx) => {
    const inserted = await tx.insertInto('stripe_events').values({ id: event.id, type: event.type }).onConflict((oc) => oc.column('id').doNothing()).returning('id').executeTakeFirst()
    if (!inserted) {
      const prev = await tx.selectFrom('stripe_events').select('processed_at').where('id', '=', event.id).executeTakeFirst()
      if (prev?.processed_at) return { status: 'duplicate' as const }
    }

    let outcome: WebhookOutcome = { status: 'ignored' }
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      const plan = session.metadata?.plan ?? ''
      const isOurs = session.metadata?.product === 'agencyos_license' && isPurchasablePlan(plan)
      if (isOurs && session.mode === 'payment' && session.payment_status === 'paid') {
        const email = session.customer_details?.email ?? session.customer_email
        if (!email) throw new AppError('validation', 'Checkout session has no customer email.')
        const issued = await issueLicense(tx, {
          plan: plan as 'standard' | 'agency',
          customerEmail: email,
          customerName: session.customer_details?.name ?? null,
          source: 'stripe',
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null),
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          notes: `Purchased via Stripe Checkout (${PLANS[plan as 'standard' | 'agency'].name})`,
        })
        outcome = { status: 'processed', licenseId: issued.id }
        if (issued.created && opts.onLicenseIssued) await opts.onLicenseIssued({ email, key: issued.key, plan }).catch((e) => console.error('[stripe] license email failed', (e as Error).message))
      }
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge
      const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
      if (pi && charge.refunded) {
        const lic = await tx.updateTable('license_keys').set({ status: 'revoked', revoked_at: new Date(), revoked_reason: 'Payment refunded' }).where('stripe_payment_intent_id', '=', pi).where('status', '!=', 'revoked').returning('id').executeTakeFirst()
        if (lic) {
          await tx.updateTable('license_activations').set({ deactivated_at: new Date(), deactivated_reason: 'License revoked: payment refunded' }).where('license_key_id', '=', lic.id).where('deactivated_at', 'is', null).execute()
          outcome = { status: 'processed', licenseId: lic.id }
        }
      }
    }
    await tx.updateTable('stripe_events').set({ processed_at: new Date() }).where('id', '=', event.id).execute()
    return outcome
  })
}

export async function emailLicenseKey(info: { email: string; key: string; plan: string }) {
  if (!isEmailConfigured()) return
  const plan = PLANS[info.plan as 'standard' | 'agency']?.name ?? info.plan
  await sendEmail({
    to: info.email,
    subject: `Your AgencyOS AI ${plan} license key`,
    text: `Thank you for your purchase.\n\nLicense key: ${info.key}\n\nActivate it in AgencyOS under Settings → License (organization owners only): ${appUrl()}/app/settings/license`,
    html: layoutEmail('Your license key', `<p>Thank you for purchasing the <strong>${escapeHtml(plan)}</strong> license.</p><p style="font-family:monospace;font-size:16px;background:#f4f4f5;padding:12px;border-radius:6px">${escapeHtml(info.key)}</p><p>Activate it under <a href="${escapeHtml(appUrl())}/app/settings/license">Settings → License</a>. Only organization owners can activate licenses.</p>`),
  })
}

/** Success page: verifies the session with Stripe before revealing anything. */
export async function getCheckoutResult(sessionId: string) {
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return { state: 'invalid' as const }
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId).catch(() => null)
  if (!session || session.metadata?.product !== 'agencyos_license') return { state: 'invalid' as const }
  if (session.payment_status !== 'paid') return { state: 'pending_payment' as const, email: session.customer_details?.email ?? null }
  const lic = await withSystem((tx) => tx.selectFrom('license_keys').select(['id', 'key_encrypted', 'plan', 'customer_email']).where('stripe_checkout_session_id', '=', session.id).executeTakeFirst())
  if (!lic) return { state: 'processing' as const, email: session.customer_details?.email ?? null }
  const { decryptLicenseKey } = await import('@/lib/licensing/keys')
  return { state: 'issued' as const, key: decryptLicenseKey(lic.key_encrypted, env().LICENSE_SECRET!), plan: lic.plan, email: lic.customer_email }
}
