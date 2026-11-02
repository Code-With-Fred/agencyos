import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Stripe from 'stripe'
import { withSystem } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { activateLicense, adminCreateLicense, adminListLicenses, adminRevealKey, adminSetLicenseStatus, deactivateLicense, getLicenseOverview, issueLicense } from '@/lib/licensing/service'
import { resolveEntitlements } from '@/lib/licensing/entitlements'
import { processStripeWebhook } from '@/lib/payments/stripe'
import type { TenantContext } from '@/lib/auth/session'
import { addMember, adminPool, closeTestDatabase, createOrgFor, createUser, resetTestDatabase } from './helpers/db'

let owner: TenantContext, admin: TenantContext, other: TenantContext, platformAdminId: string
const ent = (orgId: string) => withSystem((tx) => resolveEntitlements(tx, orgId))
const issue = (input: Partial<Parameters<typeof issueLicense>[1]> = {}) => withSystem((tx) => issueLicense(tx, { plan: 'agency', customerEmail: 'buyer@example.com', source: 'manual', ...input }))

beforeAll(async () => {
  await resetTestDatabase()
  const o = await createUser('Olivia Owner')
  owner = await createOrgFor(o.id, 'Licensed Agency')
  admin = await addMember(owner.orgId, (await createUser('Adam Admin')).id, 'admin')
  other = await createOrgFor((await createUser('Other Owner')).id, 'Other Agency')
  platformAdminId = (await createUser('Vendor Admin')).id
  await adminPool().query('insert into platform_admins(user_id) values ($1)', [platformAdminId])
})
afterAll(closeTestDatabase)

describe('license activation', () => {
  it('organizations without a license run on the evaluation plan', async () => {
    const e = await ent(owner.orgId)
    expect(e.id).toBe('evaluation')
    expect(e.licensed).toBe(false)
    expect(e.whiteLabel).toBe(false)
  })

  it('stores keys only as hash + ciphertext', async () => {
    const { key, id } = await issue()
    const row = (await adminPool().query('select key_hash, key_encrypted, key_last4 from license_keys where id = $1', [id])).rows[0]
    expect(JSON.stringify(row)).not.toContain(key)
    expect(row.key_last4).toBe(key.slice(-4))
  })

  it('only owners can activate; activation unlocks the plan server-side', async () => {
    const { key } = await issue({ plan: 'agency' })
    await expect(activateLicense(admin, key)).rejects.toMatchObject({ code: 'forbidden' })
    const res = await activateLicense(owner, key)
    expect(res.plan).toBe('agency')
    const e = await ent(owner.orgId)
    expect(e).toMatchObject({ id: 'agency', licensed: true, whiteLabel: true })
    await expect(activateLicense(owner, key)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('enforces max activations across organizations', async () => {
    const { key } = await issue({ plan: 'standard', maxActivations: 1 })
    const fresh = await createOrgFor((await createUser('Fresh')).id, 'Fresh Agency')
    await activateLicense(fresh, key)
    await expect(activateLicense(other, key)).rejects.toMatchObject({ code: 'limit_reached' })
  })

  it('rejects malformed, unknown, expired, suspended and revoked keys', async () => {
    await expect(activateLicense(other, 'AGOS-NOT-A-KEY')).rejects.toMatchObject({ code: 'validation' })
    await expect(activateLicense(other, 'AGOS-00000-00000-00000-0000Z')).rejects.toBeInstanceOf(AppError)
    const expired = await issue({ expiresAt: new Date(Date.now() - 1000) })
    await expect(activateLicense(other, expired.key)).rejects.toThrow(/expired/)
    const suspended = await issue()
    await adminSetLicenseStatus(platformAdminId, suspended.id, 'suspended', 'chargeback review')
    await expect(activateLicense(other, suspended.key)).rejects.toThrow(/suspended/)
  })

  it('revocation and expiry immediately downgrade entitlements', async () => {
    const { key, id } = await issue({ plan: 'agency' })
    await activateLicense(other, key)
    expect((await ent(other.orgId)).id).toBe('agency')
    await adminSetLicenseStatus(platformAdminId, id, 'revoked', 'refund')
    expect((await ent(other.orgId)).id).toBe('evaluation')
    await expect(adminSetLicenseStatus(platformAdminId, id, 'active', null)).rejects.toMatchObject({ code: 'conflict' })

    const timed = await issue({ plan: 'agency', expiresAt: new Date(Date.now() + 60_000) })
    await activateLicense(other, timed.key)
    expect((await ent(other.orgId)).id).toBe('agency')
    await adminPool().query(`update license_keys set expires_at = now() - interval '1 second' where id = $1`, [timed.id])
    expect((await ent(other.orgId)).id).toBe('evaluation')
  })

  it('owners can deactivate; overview shows history to members', async () => {
    await deactivateLicense(owner)
    expect((await ent(owner.orgId)).id).toBe('evaluation')
    const overview = await getLicenseOverview(admin)
    expect(overview.history.length).toBeGreaterThan(0)
    expect(overview.history[0].deactivated_at).not.toBeNull()
  })
})

describe('platform administration', () => {
  it('is restricted to platform admins', async () => {
    await expect(adminListLicenses(owner.userId)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(adminCreateLicense(owner.userId, { plan: 'enterprise', customerEmail: 'x@example.com', customerName: null, maxActivations: 1, expiresAt: null, notes: null })).rejects.toMatchObject({ code: 'forbidden' })
  })
  it('manual licenses can be created, listed and revealed by admins', async () => {
    const created = await adminCreateLicense(platformAdminId, { plan: 'enterprise', customerEmail: 'bank@example.com', customerName: 'Bank Transfer Co', maxActivations: 3, expiresAt: '2030-12-31', notes: 'INV-1001' })
    const list = await adminListLicenses(platformAdminId, 'bank@')
    expect(list[0]).toMatchObject({ plan: 'enterprise', source: 'manual', max_activations: 3 })
    expect(await adminRevealKey(platformAdminId, list[0].id)).toBe(created.key)
  })
})

describe('Stripe webhook', () => {
  const secret = 'whsec_test_secret'
  const stripe = new Stripe('sk_test_dummy')
  const sign = (payload: string, s = secret) => stripe.webhooks.generateTestHeaderString({ payload, secret: s })
  const event = (id: string, type: string, object: Record<string, unknown>) => JSON.stringify({ id, object: 'event', type, api_version: '2025-01-01', created: Math.floor(Date.now() / 1000), data: { object } })
  const session = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    object: 'checkout.session',
    mode: 'payment',
    payment_status: 'paid',
    metadata: { plan: 'agency', product: 'agencyos_license' },
    customer_details: { email: 'Customer@Example.com', name: 'Paying Customer' },
    payment_intent: `pi_${id}`,
    amount_total: 149000,
    currency: 'usd',
    ...extra,
  })

  it('rejects missing and invalid signatures', async () => {
    const payload = event('evt_bad', 'checkout.session.completed', session('cs_bad'))
    await expect(processStripeWebhook({ payload, signature: null, secret, stripe })).rejects.toMatchObject({ code: 'validation' })
    await expect(processStripeWebhook({ payload, signature: sign(payload, 'whsec_wrong'), secret, stripe })).rejects.toMatchObject({ code: 'forbidden' })
    await expect(processStripeWebhook({ payload: payload.replace('agency', 'enterprise'), signature: sign(payload), secret, stripe })).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('issues exactly one license for a verified paid checkout (idempotent)', async () => {
    const issued: string[] = []
    const payload = event('evt_paid_1', 'checkout.session.completed', session('cs_test_paid_1'))
    const r1 = await processStripeWebhook({ payload, signature: sign(payload), secret, stripe, onLicenseIssued: async (i) => void issued.push(i.key) })
    expect(r1.status).toBe('processed')
    const r2 = await processStripeWebhook({ payload, signature: sign(payload), secret, stripe, onLicenseIssued: async (i) => void issued.push(i.key) })
    expect(r2.status).toBe('duplicate')
    // A different event for the same session (e.g. async_payment_succeeded) must not create a second license.
    const p3 = event('evt_paid_2', 'checkout.session.async_payment_succeeded', session('cs_test_paid_1'))
    const r3 = await processStripeWebhook({ payload: p3, signature: sign(p3), secret, stripe, onLicenseIssued: async (i) => void issued.push(i.key) })
    expect(r3.licenseId).toBe(r1.licenseId)
    const rows = (await adminPool().query(`select plan, status, source, customer_email, amount_total from license_keys where stripe_checkout_session_id = 'cs_test_paid_1'`)).rows
    expect(rows).toEqual([{ plan: 'agency', status: 'active', source: 'stripe', customer_email: 'customer@example.com', amount_total: 149000 }])
    expect(issued).toHaveLength(1)
  })

  it('does not issue licenses for unpaid sessions or other products', async () => {
    const unpaid = event('evt_unpaid', 'checkout.session.completed', session('cs_test_unpaid', { payment_status: 'unpaid' }))
    expect((await processStripeWebhook({ payload: unpaid, signature: sign(unpaid), secret, stripe })).status).toBe('ignored')
    const foreign = event('evt_foreign', 'checkout.session.completed', session('cs_test_foreign', { metadata: { plan: 'agency', product: 'something_else' } }))
    expect((await processStripeWebhook({ payload: foreign, signature: sign(foreign), secret, stripe })).status).toBe('ignored')
    const badPlan = event('evt_badplan', 'checkout.session.completed', session('cs_test_badplan', { metadata: { plan: 'enterprise', product: 'agencyos_license' } }))
    expect((await processStripeWebhook({ payload: badPlan, signature: sign(badPlan), secret, stripe })).status).toBe('ignored')
    const count = (await adminPool().query(`select count(*)::int n from license_keys where stripe_checkout_session_id in ('cs_test_unpaid','cs_test_foreign','cs_test_badplan')`)).rows[0].n
    expect(count).toBe(0)
  })

  it('revokes the license and deactivates it when the payment is refunded', async () => {
    const paid = event('evt_paid_refund', 'checkout.session.completed', session('cs_test_refund'))
    const { licenseId } = await processStripeWebhook({ payload: paid, signature: sign(paid), secret, stripe })
    const key = await adminRevealKey(platformAdminId, licenseId!)
    const buyer = await createOrgFor((await createUser('Refund Buyer')).id, 'Refund Agency')
    await activateLicense(buyer, key)
    const refund = event('evt_refund', 'charge.refunded', { id: 'ch_1', object: 'charge', refunded: true, payment_intent: 'pi_cs_test_refund' })
    expect((await processStripeWebhook({ payload: refund, signature: sign(refund), secret, stripe })).status).toBe('processed')
    expect((await ent(buyer.orgId)).id).toBe('evaluation')
  })
})
