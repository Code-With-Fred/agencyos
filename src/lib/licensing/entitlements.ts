import 'server-only'
import { cache } from 'react'
import { sql } from 'kysely'
import { withSystem, type Tx } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { PLANS, type Module, type PlanDefinition, type PlanId } from './plans'

export type Entitlements = PlanDefinition & {
  licensed: boolean
  licenseId: string | null
  licenseLast4: string | null
  expiresAt: Date | null
}

/**
 * Resolves the organization's plan from the database on every request — it
 * cannot be influenced by browser state. An organization without a valid,
 * active, unexpired license runs on the Evaluation plan.
 */
export async function resolveEntitlements(tx: Tx, orgId: string): Promise<Entitlements> {
  const row = await tx
    .selectFrom('license_activations as a')
    .innerJoin('license_keys as k', 'k.id', 'a.license_key_id')
    .select(['k.id', 'k.plan', 'k.status', 'k.expires_at', 'k.key_last4'])
    .where('a.organization_id', '=', orgId)
    .where('a.deactivated_at', 'is', null)
    .executeTakeFirst()
  const valid = row && row.status === 'active' && (!row.expires_at || row.expires_at.getTime() > Date.now())
  const plan: PlanId = valid ? row.plan : 'evaluation'
  return {
    ...PLANS[plan],
    licensed: Boolean(valid),
    licenseId: valid ? row.id : null,
    licenseLast4: valid ? row.key_last4 : null,
    expiresAt: valid ? row.expires_at : null,
  }
}

export const getEntitlements = cache(async (orgId: string) => withSystem((tx) => resolveEntitlements(tx, orgId)))

export function assertModule(ent: Entitlements, module: Module) {
  if (!ent.modules.includes(module)) {
    throw new AppError('limit_reached', `Your ${ent.name} plan does not include this module. Upgrade to the Agency plan to unlock it.`)
  }
}

function monthStart() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export async function monthlyUsage(tx: Tx, orgId: string) {
  const since = monthStart()
  const [ai, audits] = await Promise.all([
    tx
      .selectFrom('ai_usage_logs')
      .select(sql<number>`count(*)`.as('n'))
      .where('organization_id', '=', orgId)
      .where('status', '=', 'success')
      .where('created_at', '>=', since)
      .executeTakeFirstOrThrow(),
    tx.selectFrom('website_audits').select(sql<number>`count(*)`.as('n')).where('organization_id', '=', orgId).where('created_at', '>=', since).executeTakeFirstOrThrow(),
  ])
  return { aiGenerations: Number(ai.n), audits: Number(audits.n), periodStart: since }
}

export async function assertAiQuota(tx: Tx, orgId: string, ent: Entitlements) {
  const usage = await monthlyUsage(tx, orgId)
  if (usage.aiGenerations >= ent.aiGenerationsPerMonth) {
    throw new AppError('limit_reached', `Monthly AI generation limit reached (${ent.aiGenerationsPerMonth} on the ${ent.name} plan). The limit resets on the 1st of next month.`)
  }
}

export async function assertAuditQuota(tx: Tx, orgId: string, ent: Entitlements) {
  const usage = await monthlyUsage(tx, orgId)
  if (usage.audits >= ent.auditsPerMonth) {
    throw new AppError('limit_reached', `Monthly website audit limit reached (${ent.auditsPerMonth} on the ${ent.name} plan).`)
  }
}
