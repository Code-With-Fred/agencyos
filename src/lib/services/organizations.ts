import 'server-only'
import { sql } from 'kysely'
import { withUser } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { assertCan } from '@/lib/auth/permissions'
import type { TenantContext } from '@/lib/auth/session'
import type { BrandingInput, OrganizationInput } from '@/lib/validators/org'
import { logActivity } from './activity'
import { removeOrgAsset, uploadOrgAsset } from '@/lib/storage/storage'
import type { ValidatedImage } from '@/lib/security/upload'

/** Atomic org + owner membership + branding creation (SQL SECURITY DEFINER function). */
export async function createOrganization(userId: string, input: OrganizationInput): Promise<string> {
  return withUser(userId, async (tx) => {
    const res = await sql<{ id: string }>`
      select app.create_organization(${input.name}, ${input.website}, ${input.industry}, ${input.country}, ${input.businessEmail}, ${input.brandColor}) as id
    `.execute(tx)
    return res.rows[0].id
  })
}

export async function getOrganization(ctx: TenantContext) {
  return withUser(ctx.userId, (tx) => tx.selectFrom('organizations').selectAll().where('id', '=', ctx.orgId).executeTakeFirstOrThrow())
}

export async function updateOrganization(ctx: TenantContext, input: OrganizationInput) {
  assertCan(ctx.role, 'org:update')
  await withUser(ctx.userId, async (tx) => {
    await tx
      .updateTable('organizations')
      .set({ name: input.name, website: input.website, industry: input.industry, country: input.country, business_email: input.businessEmail, brand_color: input.brandColor })
      .where('id', '=', ctx.orgId)
      .executeTakeFirstOrThrow()
    await logActivity(tx, ctx, { action: 'organization.updated', entityType: 'organization', entityId: ctx.orgId, summary: 'Updated organization profile' })
  })
}

export async function deleteOrganization(ctx: TenantContext, confirmName: string) {
  assertCan(ctx.role, 'org:delete')
  await withUser(ctx.userId, async (tx) => {
    const org = await tx.selectFrom('organizations').select(['name']).where('id', '=', ctx.orgId).executeTakeFirstOrThrow()
    if (org.name.trim() !== confirmName.trim()) throw new AppError('validation', 'Type the organization name exactly to confirm deletion.')
    await tx.deleteFrom('organizations').where('id', '=', ctx.orgId).execute()
  })
}

export async function getBranding(ctx: TenantContext) {
  return withUser(ctx.userId, async (tx) => {
    const [org, branding] = await Promise.all([
      tx.selectFrom('organizations').select(['name', 'brand_color', 'logo_path', 'website', 'business_email']).where('id', '=', ctx.orgId).executeTakeFirstOrThrow(),
      tx.selectFrom('branding_settings').selectAll().where('organization_id', '=', ctx.orgId).executeTakeFirst(),
    ])
    return { org, branding: branding ?? null }
  })
}

export async function updateBranding(ctx: TenantContext, input: BrandingInput, allowWhiteLabel: boolean) {
  assertCan(ctx.role, 'branding:update')
  if (input.whiteLabelEnabled && !allowWhiteLabel) {
    throw new AppError('limit_reached', 'White-label reports require the Agency or Enterprise plan.')
  }
  await withUser(ctx.userId, async (tx) => {
    await tx.updateTable('organizations').set({ brand_color: input.brandColor }).where('id', '=', ctx.orgId).execute()
    const values = {
      company_name: input.companyName,
      accent_color: input.accentColor,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      contact_website: input.contactWebsite,
      address: input.address,
      report_footer: input.reportFooter,
      report_title_default: input.reportTitleDefault,
      white_label_enabled: input.whiteLabelEnabled,
    }
    await tx
      .insertInto('branding_settings')
      .values({ organization_id: ctx.orgId, ...values })
      .onConflict((oc) => oc.column('organization_id').doUpdateSet(values))
      .execute()
    await logActivity(tx, ctx, { action: 'branding.updated', entityType: 'organization', entityId: ctx.orgId, summary: 'Updated branding settings' })
  })
}

export async function setLogo(ctx: TenantContext, image: ValidatedImage | null) {
  assertCan(ctx.role, 'branding:update')
  const current = await withUser(ctx.userId, (tx) => tx.selectFrom('organizations').select('logo_path').where('id', '=', ctx.orgId).executeTakeFirstOrThrow())
  const path = image ? await uploadOrgAsset(ctx.orgId, 'logo', image.buffer, image.mime, image.ext) : null
  await withUser(ctx.userId, async (tx) => {
    await tx.updateTable('organizations').set({ logo_path: path }).where('id', '=', ctx.orgId).execute()
    await logActivity(tx, ctx, { action: image ? 'branding.logo_uploaded' : 'branding.logo_removed', entityType: 'organization', entityId: ctx.orgId, summary: image ? 'Uploaded a new logo' : 'Removed the logo' })
  })
  if (current.logo_path) await removeOrgAsset(ctx.orgId, current.logo_path).catch(() => undefined)
}
