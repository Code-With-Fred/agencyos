import 'server-only'
import type { Tx } from '@/lib/db'
import { json } from '@/lib/db'
import type { TenantContext } from '@/lib/auth/session'

export type ActivityInput = {
  action: string
  entityType: string
  entityId?: string | null
  summary: string
  metadata?: Record<string, unknown>
}

/** Writes an audit-log entry inside the caller's transaction. Never logs secrets or document bodies. */
export async function logActivity(tx: Tx, ctx: Pick<TenantContext, 'userId' | 'orgId'>, input: ActivityInput) {
  await tx
    .insertInto('activity_logs')
    .values({
      organization_id: ctx.orgId,
      actor_id: ctx.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      summary: input.summary.slice(0, 500),
      metadata: json(input.metadata ?? {}),
    })
    .execute()
}
