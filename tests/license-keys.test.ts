import { describe, expect, it } from 'vitest'
import { decryptLicenseKey, encryptLicenseKey, generateLicenseKey, hashLicenseKey, isWellFormedLicenseKey, normalizeLicenseKey } from '@/lib/licensing/keys'

const SECRET = 'unit-test-secret-0123456789abcdefghijklmn'

describe('license keys', () => {
  it('generates unique, well-formed keys with a checksum', () => {
    const keys = new Set(Array.from({ length: 500 }, generateLicenseKey))
    expect(keys.size).toBe(500)
    for (const k of keys) {
      expect(k).toMatch(/^AGOS-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}$/)
      expect(isWellFormedLicenseKey(k)).toBe(true)
    }
  })
  it('detects typos via the checksum', () => {
    const k = generateLicenseKey()
    const last = k.at(-1)!
    const typo = k.slice(0, -1) + (last === '0' ? '1' : '0')
    expect(isWellFormedLicenseKey(typo)).toBe(false)
  })
  it('normalizes user input', () => {
    const k = generateLicenseKey()
    expect(normalizeLicenseKey(` ${k.toLowerCase().replace(/-/g, ' ')} `)).toBe(k)
    expect(normalizeLicenseKey(k.replace(/-/g, ''))).toBe(k)
    expect(normalizeLicenseKey('AGOS-123')).toBe('')
  })
  it('hashes deterministically with a secret', () => {
    const k = generateLicenseKey()
    expect(hashLicenseKey(k, SECRET)).toBe(hashLicenseKey(k, SECRET))
    expect(hashLicenseKey(k, SECRET)).not.toBe(hashLicenseKey(k, `${SECRET}x`))
    expect(hashLicenseKey(k, SECRET)).not.toContain(k)
  })
  it('encrypts with authenticated encryption', () => {
    const k = generateLicenseKey()
    const enc = encryptLicenseKey(k, SECRET)
    expect(enc).not.toContain(k)
    expect(decryptLicenseKey(enc, SECRET)).toBe(k)
    const parts = enc.split('.')
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA')
    expect(() => decryptLicenseKey(parts.join('.'), SECRET)).toThrow()
    expect(() => decryptLicenseKey(enc, `${SECRET}-other`)).toThrow()
  })
  it('refuses weak secrets', () => expect(() => hashLicenseKey(generateLicenseKey(), 'short')).toThrow(/32 characters/))
})
