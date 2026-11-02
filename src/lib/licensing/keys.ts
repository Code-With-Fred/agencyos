import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomInt } from 'node:crypto'

/**
 * License key format: AGOS-XXXXX-XXXXX-XXXXX-XXXXX
 * 20 Crockford base32 characters (no I, L, O, U): 19 random + 1 checksum.
 * ~95 bits of entropy. Keys are stored as an HMAC (for lookup) and encrypted
 * with AES-256-GCM (so admins can re-send a key) — never in plain text.
 */
export const KEY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const PREFIX = 'AGOS'

function checksumChar(chars: string): string {
  let sum = 0
  for (let i = 0; i < chars.length; i++) sum = (sum * 31 + KEY_ALPHABET.indexOf(chars[i]) * (i + 7)) % 32
  return KEY_ALPHABET[sum]
}

export function generateLicenseKey(): string {
  let body = ''
  for (let i = 0; i < 19; i++) body += KEY_ALPHABET[randomInt(0, 32)]
  body += checksumChar(body)
  return `${PREFIX}-${body.match(/.{5}/g)!.join('-')}`
}

/** Normalizes user input: uppercase, strips spaces, maps ambiguous characters. */
export function normalizeLicenseKey(input: string): string {
  let raw = (input ?? '').toUpperCase().replace(/[\s-]/g, '')
  if (raw.startsWith(PREFIX)) raw = raw.slice(PREFIX.length)
  const body = raw.replace(/O/g, '0').replace(/[IL]/g, '1')
  if (body.length !== 20) return ''
  return `${PREFIX}-${body.match(/.{5}/g)!.join('-')}`
}

export function isWellFormedLicenseKey(key: string): boolean {
  const m = /^AGOS-([0-9A-HJKMNP-TV-Z]{5})-([0-9A-HJKMNP-TV-Z]{5})-([0-9A-HJKMNP-TV-Z]{5})-([0-9A-HJKMNP-TV-Z]{5})$/.exec(key)
  if (!m) return false
  const body = m.slice(1).join('')
  return checksumChar(body.slice(0, 19)) === body[19]
}

function derive(secret: string, purpose: 'hash' | 'encrypt'): Buffer {
  if (!secret || secret.length < 32) throw new Error('LICENSE_SECRET must be at least 32 characters')
  return Buffer.from(hkdfSync('sha256', secret, 'agencyos-license', `agencyos/${purpose}/v1`, 32))
}

export function hashLicenseKey(key: string, secret: string): string {
  return createHmac('sha256', derive(secret, 'hash')).update(key).digest('hex')
}

export function encryptLicenseKey(key: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', derive(secret, 'encrypt'), iv)
  const enc = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.')
}

export function decryptLicenseKey(payload: string, secret: string): string {
  const [v, iv, tag, data] = payload.split('.')
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported key payload')
  const decipher = createDecipheriv('aes-256-gcm', derive(secret, 'encrypt'), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}
