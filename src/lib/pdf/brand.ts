import 'server-only'
import { withSystem, withUser, type Tx } from '@/lib/db'
import { resolveEntitlements } from '@/lib/licensing/entitlements'
import { downloadOrgAsset } from '@/lib/storage/storage'
import { detectImage } from '@/lib/security/upload'

export type BrandKit = {
  companyName: string
  brandColor: string
  accentColor: string
  logo: { data: Buffer; format: 'png' | 'jpg' } | null
  footer: string | null
  contactLine: string | null
  /** Effective white-label: setting enabled AND plan allows it. */
  whiteLabel: boolean
}

async function build(tx: Tx, orgId: string): Promise<BrandKit> {
  const [org, branding, ent] = await Promise.all([
    tx.selectFrom('organizations').select(['name', 'brand_color', 'logo_path', 'website', 'business_email']).where('id', '=', orgId).executeTakeFirstOrThrow(),
    tx.selectFrom('branding_settings').selectAll().where('organization_id', '=', orgId).executeTakeFirst(),
    resolveEntitlements(tx, orgId),
  ])
  let logo: BrandKit['logo'] = null
  if (org.logo_path) {
    const buf = await downloadOrgAsset(orgId, org.logo_path).catch(() => null)
    const mime = buf ? detectImage(buf) : null
    if (buf && mime) logo = { data: buf, format: mime === 'image/png' ? 'png' : 'jpg' }
  }
  const contact = [branding?.contact_website ?? org.website, branding?.contact_email ?? org.business_email, branding?.contact_phone].filter(Boolean).map((s) => String(s).replace(/^https?:\/\//, ''))
  return {
    companyName: branding?.company_name || org.name,
    brandColor: org.brand_color,
    accentColor: branding?.accent_color ?? '#0EA5E9',
    logo,
    footer: branding?.report_footer ?? null,
    contactLine: contact.length ? contact.join('  ·  ') : null,
    whiteLabel: Boolean(branding?.white_label_enabled && ent.whiteLabel),
  }
}

export async function loadBrandKit(userId: string, orgId: string) {
  // Verify membership through RLS first, then read license/branding data
  // (license tables are only readable in the system context).
  const ok = await withUser(userId, (tx) => tx.selectFrom('organizations').select('id').where('id', '=', orgId).executeTakeFirst())
  if (!ok) throw new Error('forbidden')
  return withSystem((tx) => build(tx, orgId))
}

/** For token-verified public share links only. */
export async function loadBrandKitForShare(orgId: string) {
  return withSystem((tx) => build(tx, orgId))
}
