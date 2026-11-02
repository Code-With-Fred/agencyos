import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors'
import { generateToken } from '@/lib/security/tokens'

let client: SupabaseClient | null = null

export function isStorageConfigured(): boolean {
  const e = env()
  return Boolean(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY)
}

/** Service-role client — server only, never sent to the browser. */
function storage() {
  const e = env()
  if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError('not_configured', 'File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  client ??= createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  return client.storage.from(e.SUPABASE_STORAGE_BUCKET)
}

function assertOrgPath(orgId: string, path: string) {
  if (!path.startsWith(`${orgId}/`) || path.includes('..')) throw new AppError('forbidden', 'Invalid asset path.')
}

export async function uploadOrgAsset(orgId: string, kind: 'logo', buffer: Buffer, mime: string, ext: string): Promise<string> {
  const path = `${orgId}/${kind}-${generateToken(12)}.${ext}`
  const { error } = await storage().upload(path, buffer, { contentType: mime, upsert: false, cacheControl: '3600' })
  if (error) {
    console.error('[storage] upload failed', error.message)
    throw new AppError('upstream_failed', 'The file could not be stored. Check your storage configuration.')
  }
  return path
}

export async function removeOrgAsset(orgId: string, path: string): Promise<void> {
  assertOrgPath(orgId, path)
  await storage().remove([path])
}

export async function downloadOrgAsset(orgId: string, path: string): Promise<Buffer | null> {
  if (!isStorageConfigured()) return null
  assertOrgPath(orgId, path)
  const { data, error } = await storage().download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

export async function signedAssetUrl(orgId: string, path: string | null, seconds = 3600): Promise<string | null> {
  if (!path || !isStorageConfigured()) return null
  assertOrgPath(orgId, path)
  const { data, error } = await storage().createSignedUrl(path, seconds)
  if (error) return null
  return data.signedUrl
}
