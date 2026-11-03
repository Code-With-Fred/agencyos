import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getAuth } from '@/lib/auth/auth'
import { safeNext } from '@/lib/safe-redirect'
import { adminPool, closeTestDatabase, resetTestDatabase } from './helpers/db'

const origin = 'http://localhost:3000'
const post = (path: string, body: unknown, cookie?: string) =>
  getAuth().handler(
    new Request(`${origin}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 200)}`, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  )
const cookieFrom = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

beforeAll(resetTestDatabase)
afterAll(closeTestDatabase)

describe('email + password authentication', () => {
  it('registers a user and stores only a password hash', async () => {
    const res = await post('/sign-up/email', { name: 'Reg User', email: 'reg@example.com', password: 'correct horse battery' })
    expect(res.status).toBe(200)
    const acct = (await adminPool().query(`select a.password from account a join "user" u on u.id = a."userId" where u.email = 'reg@example.com'`)).rows[0]
    expect(acct.password).toBeTruthy()
    expect(acct.password).not.toContain('correct horse')
  })

  it('rejects weak passwords and duplicate emails', async () => {
    expect((await post('/sign-up/email', { name: 'Weak', email: 'weak@example.com', password: 'short' })).status).toBeGreaterThanOrEqual(400)
    expect((await post('/sign-up/email', { name: 'Dup', email: 'reg@example.com', password: 'another long password' })).status).toBeGreaterThanOrEqual(400)
  })

  it('signs in with the correct password and issues a session', async () => {
    const res = await post('/sign-in/email', { email: 'reg@example.com', password: 'correct horse battery' })
    expect(res.status).toBe(200)
    const cookie = cookieFrom(res)
    expect(cookie).toContain('agencyos.session_token')
    const session = await getAuth().api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.email).toBe('reg@example.com')
  })

  it('rejects wrong passwords and unknown users', async () => {
    expect((await post('/sign-in/email', { email: 'reg@example.com', password: 'wrong password!!' })).status).toBe(401)
    expect((await post('/sign-in/email', { email: 'nobody@example.com', password: 'whatever password' })).status).toBe(401)
  })

  it('rejects cross-origin auth requests (CSRF protection)', async () => {
    const res = await getAuth().handler(
      new Request(`${origin}/api/auth/sign-in/email`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example.org', cookie: 'agencyos.session_token=x' }, body: JSON.stringify({ email: 'reg@example.com', password: 'correct horse battery' }) }),
    )
    expect(res.status).toBe(403)
  })

  it('changes the password and revokes other sessions', async () => {
    const a = cookieFrom(await post('/sign-in/email', { email: 'reg@example.com', password: 'correct horse battery' }))
    const b = cookieFrom(await post('/sign-in/email', { email: 'reg@example.com', password: 'correct horse battery' }))
    const res = await post('/change-password', { currentPassword: 'correct horse battery', newPassword: 'a brand new password', revokeOtherSessions: true }, a)
    expect(res.status).toBe(200)
    expect(await getAuth().api.getSession({ headers: new Headers({ cookie: b }) })).toBeNull()
    expect((await post('/sign-in/email', { email: 'reg@example.com', password: 'a brand new password' })).status).toBe(200)
  })

  it('signs out', async () => {
    const cookie = cookieFrom(await post('/sign-in/email', { email: 'reg@example.com', password: 'a brand new password' }))
    expect((await post('/sign-out', {}, cookie)).status).toBe(200)
    expect(await getAuth().api.getSession({ headers: new Headers({ cookie }) })).toBeNull()
  })

  it('password reset requests do not reveal whether an account exists', async () => {
    const known = await post('/request-password-reset', { email: 'reg@example.com', redirectTo: '/reset-password' })
    const unknown = await post('/request-password-reset', { email: 'ghost@example.com', redirectTo: '/reset-password' })
    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(await known.json()).toEqual(await unknown.json())
  })
})

describe('demo access', () => {
  it('signs into the demo account without a password', async () => {
    await adminPool().query(`insert into "user"(id, name, email, "emailVerified") values ('demo_user', 'Demo Owner', 'demo@agencyos.test', true) on conflict do nothing`)
    const res = await post('/demo/sign-in', {})
    expect(res.status).toBe(200)
    const session = await getAuth().api.getSession({ headers: new Headers({ cookie: cookieFrom(res) }) })
    expect(session?.user.email).toBe('demo@agencyos.test')
  })
  it('can be turned off with DEMO_ACCESS=off', async () => {
    process.env.DEMO_ACCESS = 'off'
    try {
      expect((await post('/demo/sign-in', {})).status).toBe(403)
    } finally {
      delete process.env.DEMO_ACCESS
    }
  })
})

describe('post-auth redirects', () => {
  it('only allows same-site relative paths', () => {
    expect(safeNext('/app/clients')).toBe('/app/clients')
    expect(safeNext('https://evil.com')).toBe('/app')
    expect(safeNext('//evil.com')).toBe('/app')
    expect(safeNext('/\\evil.com')).toBe('/app')
    expect(safeNext(undefined, '/app/setup')).toBe('/app/setup')
  })
})
