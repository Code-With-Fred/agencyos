import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { detectImage, validateImageUpload } from '@/lib/security/upload'
import { rateLimit } from '@/lib/security/rate-limit'
import { assertSameOrigin } from '@/lib/security/origin'
import { generateToken, hashToken, isPlausibleToken } from '@/lib/security/tokens'
import { toBlocks } from '@/lib/content/blocks'
import { env, __resetEnvCache } from '@/lib/env'
import { fromPgError, toActionError, AppError } from '@/lib/errors'
import { closeTestDatabase, resetTestDatabase } from './helpers/db'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const file = (bytes: Buffer, name = 'logo.png', type = 'image/png') => new File([new Uint8Array(bytes)], name, { type })

describe('secure file uploads', () => {
  it('detects images by magic bytes, ignoring name and MIME type', async () => {
    expect(detectImage(PNG)).toBe('image/png')
    expect(detectImage(JPG)).toBe('image/jpeg')
    expect((await validateImageUpload(file(JPG, 'x.png', 'image/png'))).mime).toBe('image/jpeg')
  })
  it('rejects SVG, HTML and other content even when labelled as an image', async () => {
    await expect(validateImageUpload(file(Buffer.from('<svg onload="alert(1)"></svg>'), 'logo.png', 'image/png'))).rejects.toThrow(/PNG and JPEG/)
    await expect(validateImageUpload(file(Buffer.from('<html><script>x</script>'), 'logo.jpg', 'image/jpeg'))).rejects.toThrow(/PNG and JPEG/)
    await expect(validateImageUpload(file(Buffer.from('GIF89a....'), 'a.gif', 'image/gif'))).rejects.toThrow()
  })
  it('enforces size limits and rejects empty or missing files', async () => {
    await expect(validateImageUpload(file(Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)])))).rejects.toThrow(/2 MB/)
    await expect(validateImageUpload(file(Buffer.alloc(0)))).rejects.toThrow(/empty/)
    await expect(validateImageUpload(null)).rejects.toThrow()
    await expect(validateImageUpload('not a file')).rejects.toThrow()
  })
})

describe('CSRF origin checks for route handlers', () => {
  const req = (headers: Record<string, string>) => new Request('http://localhost:3000/api/audits', { method: 'POST', headers })
  it('accepts same-origin requests', () => {
    expect(() => assertSameOrigin(req({ origin: 'http://localhost:3000' }))).not.toThrow()
    expect(() => assertSameOrigin(req({ 'sec-fetch-site': 'same-origin' }))).not.toThrow()
  })
  it('rejects cross-origin or origin-less requests', () => {
    expect(() => assertSameOrigin(req({ origin: 'https://evil.example.org' }))).toThrow(AppError)
    expect(() => assertSameOrigin(req({ 'sec-fetch-site': 'cross-site' }))).toThrow(AppError)
    expect(() => assertSameOrigin(req({}))).toThrow(AppError)
  })
})

describe('tokens', () => {
  it('are 256-bit URL-safe and stored only as hashes', () => {
    const t = generateToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hashToken(t)).toHaveLength(64)
    expect(isPlausibleToken(t)).toBe(true)
    expect(isPlausibleToken("'; drop table--")).toBe(false)
  })
})

describe('rate limiting (Postgres-backed)', () => {
  beforeAll(resetTestDatabase)
  afterAll(closeTestDatabase)
  it('allows up to the limit then rejects with retry-after', async () => {
    const key = `test:${Date.now()}`
    for (let i = 0; i < 3; i++) await rateLimit({ key, limit: 3, windowSeconds: 60 })
    const err = await rateLimit({ key, limit: 3, windowSeconds: 60 }).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('rate_limited')
    expect(err.retryAfter).toBeGreaterThan(0)
  })
})

describe('safe content rendering', () => {
  it('parses headings, lists and paragraphs without HTML', () => {
    expect(toBlocks('## Goals\n- One\n- Two\n\n1. First\n2. Second\n\nPlain <b>text</b>')).toEqual([
      { type: 'heading', text: 'Goals' },
      { type: 'list', items: ['One', 'Two'], ordered: false },
      { type: 'list', items: ['First', 'Second'], ordered: true },
      { type: 'paragraph', text: 'Plain <b>text</b>' },
    ])
  })
})

describe('environment validation and error mapping', () => {
  it('fails fast with a clear message for invalid secrets', () => {
    const prev = process.env.BETTER_AUTH_SECRET
    process.env.BETTER_AUTH_SECRET = 'too-short'
    __resetEnvCache()
    expect(() => env()).toThrow(/BETTER_AUTH_SECRET/)
    process.env.BETTER_AUTH_SECRET = prev
    __resetEnvCache()
    expect(env().BETTER_AUTH_SECRET).toBe(prev)
  })
  it('never leaks internal error details to clients', () => {
    expect(toActionError(new Error('connection to 10.0.0.5 failed: password=hunter2'))).toEqual({ code: 'internal', message: 'Something went wrong. Please try again.' })
    expect(fromPgError({ code: '42501', message: 'new row violates row-level security policy' })?.code).toBe('forbidden')
    expect(fromPgError({ code: 'P0001', message: 'invitation_expired' })?.message).toMatch(/expired/)
  })
})
