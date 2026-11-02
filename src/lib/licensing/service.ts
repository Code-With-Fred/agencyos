import 'server-only'
import { sql } from 'kysely'
import { withSystem, withUser, type Tx } from '@/lib/db'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors'
import { assertCan } from '@/lib/auth/permissions'
import type { TenantContext } from '@/lib/auth/session'
import type { LicensePlan } from '@/lib/db/types'
import { rateLimit } from '@/lib/security/rate-limit'
import { decryptLicenseKey, encryptLicenseKey, generateLicenseKey, hashLicenseKey, isWellFormedLicenseKey, normalizeLicenseKey } from './keys'
import { resolveEntitlements } from './entitlements'

function licenseSecret(): string {
  const s = env().LICENSE_SECRET
  if (!s || s.length < 32) throw new AppError('not_configured', 'Licensing is not configured. Set LICENSE_SECRET (at least 32 characters).')
  return s
}

export type IssueInput = {
  plan: LicensePlan
  customerEmail: string
  customerName?: string | null
  source: 'stripe' | 'manual'
  maxActivations?: number
  expiresAt?: Date | null
  notes?: string | null
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  amountTotal?: number | null
  currency?: string | null
  createdBy?: string | null
}

/**
 * Issues a license inside a system transaction. Idempotent for Stripe
 * sessions via the unique stripe_checkout_session_id constraint.
 */
export async function issueLicense(tx: Tx, input: IssueInput): Promise<{ id: string; key: string; created: boolean }> {
  const secret = licenseSecret()
  if (input.stripeCheckoutSessionId) {
    const existing = await tx.selectFrom('license_keys').select(['id', 'key_encrypted']).where('stripe_checkout_session_id', '=', input.stripeCheckoutSessionId).executeTakeFirst()
    if (existing) return { id: existing.id, key: decryptLicenseKey(existing.key_encrypted, secret), created: false }
  }
  const key = generateLicenseKey()
  const row = await tx
    .insertInto('license_keys')
    .values({
      key_hash: hashLicenseKey(key, secret),
      key_encrypted: encryptLicenseKey(key, secret),
      key_last4: key.slice(-4),
      plan: input.plan,
      status: 'active',
      source: input.source,
      max_activations: input.maxActivations ?? 1,
      expires_at: input.expiresAt ?? null,
      customer_email: input.customerEmail.toLowerCase(),
      customer_name: input.customerName ?? null,
      notes: input.notes ?? null,
      stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      amount_total: input.amountTotal ?? null,
      currency: input.currency ?? null,
      created_by: input.createdBy ?? null,
    })
    .onConflict((oc) => oc.column('stripe_checkout_session_id').doNothing())
    .returning('id')
    .executeTakeFirst()
  if (!row) {
    // Lost a race with a concurrent webhook delivery for the same session.
    const existing = await tx.selectFrom('license_keys').select(['id', 'key_encrypted']).where('stripe_checkout_session_id', '=', input.stripeCheckoutSessionId!).executeTakeFirstOrThrow()
    return { id: existing.id, key: decryptLicenseKey(existing.key_encrypted, secret), created: false }
  }
  return { id: row.id, key, created: true }
}

/** Owner activates a key for their organization. All checks are server-side. */
export async function activateLicense(ctx: TenantContext, rawKey: string) {
  assertCan(ctx.role, 'license:manage')
  await rateLimit({ key: `license-activate:${ctx.orgId}`, limit: 10, windowSeconds: 3600, message: 'Too many activation attempts. Try again in an hour.' })
  const key = normalizeLicenseKey(rawKey)
  if (!isWellFormedLicenseKey(key)) throw new AppError('validation', 'That does not look like a valid license key. Check for typos.')
  const secret = licenseSecret()
  return withSystem(async (tx) => {
    const lic = await tx.selectFrom('license_keys').selectAll().where('key_hash', '=', hashLicenseKey(key, secret)).forUpdate().executeTakeFirst()
    if (!lic) throw new AppError('not_found', 'License key not found.')
    if (lic.status === 'revoked') throw new AppError('forbidden', 'This license has been revoked. Contact support.')
    if (lic.status === 'suspended') throw new AppError('forbidden', 'This license is suspended. Contact support.')
    if (lic.expires_at && lic.expires_at.getTime() <= Date.now()) throw new AppError('forbidden', 'This license has expired.')
    const current = await tx.selectFrom('license_activations').select(['id', 'license_key_id']).where('organization_id', '=', ctx.orgId).where('deactivated_at', 'is', null).executeTakeFirst()
    if (current?.license_key_id === lic.id) throw new AppError('conflict', 'This license is already active for this organization.')
    const used = await tx.selectFrom('license_activations').select(sql<number>`count(*)`.as('n')).where('license_key_id', '=', lic.id).where('deactivated_at', 'is', null).executeTakeFirstOrThrow()
    if (Number(used.n) >= lic.max_activations) throw new AppError('limit_reached', 'This license is already activated for the maximum number of organizations.')
    if (current) {
      await tx.updateTable('license_activations').set({ deactivated_at: new Date(), deactivated_reason: 'Replaced by a new license' }).where('id', '=', current.id).execute()
    }
    await tx.insertInto('license_activations').values({ license_key_id: lic.id, organization_id: ctx.orgId, activated_by: ctx.userId }).execute()
    await tx
      .insertInto('activity_logs')
      .values({ organization_id: ctx.orgId, actor_id: ctx.userId, action: 'license.activated', entity_type: 'license', entity_id: lic.id, summary: `Activated a ${lic.plan} license (…${lic.key_last4})`, metadata: '{}' })
      .execute()
    return { plan: lic.plan }
  }, ctx.userId)
}

export async function deactivateLicense(ctx: TenantContext) {
  assertCan(ctx.role, 'license:manage')
  await withSystem(async (tx) => {
    const res = await tx.updateTable('license_activations').set({ deactivated_at: new Date(), deactivated_reason: 'Deactivated by organization owner' }).where('organization_id', '=', ctx.orgId).where('deactivated_at', 'is', null).executeTakeFirst()
    if (!res.numUpdatedRows) throw new AppError('not_found', 'No active license to deactivate.')
    await tx.insertInto('activity_logs').values({ organization_id: ctx.orgId, actor_id: ctx.userId, action: 'license.deactivated', entity_type: 'license', summary: 'Deactivated the organization license', metadata: '{}' }).execute()
  }, ctx.userId)
}

export async function getLicenseOverview(ctx: TenantContext) {
  // Membership verified through RLS before reading platform tables.
  const member = await withUser(ctx.userId, (tx) => tx.selectFrom('organizations').select('id').where('id', '=', ctx.orgId).executeTakeFirst())
  if (!member) throw new AppError('forbidden', 'Not a member of this organization.')
  return withSystem(async (tx) => {
    const [ent, history] = await Promise.all([
      resolveEntitlements(tx, ctx.orgId),
      tx
        .selectFrom('license_activations as a')
        .innerJoin('license_keys as k', 'k.id', 'a.license_key_id')
        .leftJoin('user as u', 'u.id', 'a.activated_by')
        .select(['a.id', 'a.activated_at', 'a.deactivated_at', 'a.deactivated_reason', 'k.plan', 'k.key_last4', 'k.status', 'k.expires_at', 'u.name as activatedBy'])
        .where('a.organization_id', '=', ctx.orgId)
        .orderBy('a.activated_at', 'desc')
        .limit(20)
        .execute(),
    ])
    return { ent, history }
  })
}

// ---------------------------------------------------------------------------
// Platform administration (vendor). Every function re-checks platform_admins.
// ---------------------------------------------------------------------------

export async function assertPlatformAdmin(userId: string) {
  const ok = await withUser(userId, (tx) => tx.selectFrom('platform_admins').select('user_id').where('user_id', '=', userId).executeTakeFirst())
  if (!ok) throw new AppError('forbidden', 'Platform administrator access required.')
}

export async function adminListLicenses(userId: string, q = '') {
  await assertPlatformAdmin(userId)
  return withSystem(async (tx) => {
    let query = tx
      .selectFrom('license_keys as k')
      .select(['k.id', 'k.plan', 'k.status', 'k.source', 'k.key_last4', 'k.customer_email', 'k.customer_name', 'k.max_activations', 'k.expires_at', 'k.amount_total', 'k.currency', 'k.created_at', 'k.revoked_reason', 'k.notes'])
      .select((eb) => [eb.selectFrom('license_activations as a').select(sql<number>`count(*)`.as('n')).whereRef('a.license_key_id', '=', 'k.id').where('a.deactivated_at', 'is', null).as('activeActivations')])
    const term = q.trim().slice(0, 120)
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      query = query.where((eb) => eb.or([eb('k.customer_email', 'ilike', like), eb('k.customer_name', 'ilike', like), eb('k.key_last4', '=', term.toUpperCase().slice(-4))]))
    }
    return query.orderBy('k.created_at', 'desc').limit(200).execute()
  })
}

export async function adminCreateLicense(userId: string, input: { plan: LicensePlan; customerEmail: string; customerName: string | null; maxActivations: number; expiresAt: string | null; notes: string | null }) {
  await assertPlatformAdmin(userId)
  return withSystem((tx) =>
    issueLicense(tx, {
      plan: input.plan,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      source: 'manual',
      maxActivations: input.maxActivations,
      expiresAt: input.expiresAt ? new Date(`${input.expiresAt}T23:59:59Z`) : null,
      notes: input.notes,
      createdBy: userId,
    }),
  )
}

export async function adminSetLicenseStatus(userId: string, id: string, status: 'active' | 'suspended' | 'revoked', reason: string | null) {
  await assertPlatformAdmin(userId)
  await withSystem(async (tx) => {
    const lic = await tx.selectFrom('license_keys').select(['status']).where('id', '=', id).forUpdate().executeTakeFirst()
    if (!lic) throw new AppError('not_found', 'License not found.')
    if (lic.status === 'revoked') throw new AppError('conflict', 'Revoked licenses cannot be changed. Issue a new license instead.')
    await tx
      .updateTable('license_keys')
      .set({ status, revoked_at: status === 'revoked' ? new Date() : null, revoked_reason: status === 'active' ? null : reason })
      .where('id', '=', id)
      .execute()
    if (status === 'revoked') {
      await tx.updateTable('license_activations').set({ deactivated_at: new Date(), deactivated_reason: `License revoked${reason ? `: ${reason}` : ''}` }).where('license_key_id', '=', id).where('deactivated_at', 'is', null).execute()
    }
  })
}

export async function adminRevealKey(userId: string, id: string): Promise<string> {
  await assertPlatformAdmin(userId)
  const secret = licenseSecret()
  const row = await withSystem((tx) => tx.selectFrom('license_keys').select('key_encrypted').where('id', '=', id).executeTakeFirst())
  if (!row) throw new AppError('not_found', 'License not found.')
  console.info(`[license] key revealed id=${id} by=${userId}`)
  return decryptLicenseKey(row.key_encrypted, secret)
}

export async function adminLicenseActivations(userId: string, id: string) {
  await assertPlatformAdmin(userId)
  return withSystem((tx) =>
    tx
      .selectFrom('license_activations as a')
      .innerJoin('organizations as o', 'o.id', 'a.organization_id')
      .select(['a.id', 'a.activated_at', 'a.deactivated_at', 'a.deactivated_reason', 'o.name as orgName'])
      .where('a.license_key_id', '=', id)
      .orderBy('a.activated_at', 'desc')
      .execute(),
  )
}
