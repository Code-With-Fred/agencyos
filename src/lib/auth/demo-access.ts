import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'

/**
 * One-click demo access for evaluating the product without signing in.
 * POST /api/auth/demo/sign-in creates a session for the pre-provisioned demo
 * user — no password is stored or sent. Turn it off with DEMO_ACCESS=off.
 */
export const DEMO_EMAIL = 'demo@agencyos.test'

export function isDemoAccessEnabled(): boolean {
  return (process.env.DEMO_ACCESS ?? 'on').toLowerCase() !== 'off'
}

export const demoAccess = () =>
  ({
    id: 'demo-access',
    endpoints: {
      demoSignIn: createAuthEndpoint('/demo/sign-in', { method: 'POST' }, async (ctx) => {
        if (!isDemoAccessEnabled()) throw new APIError('FORBIDDEN', { message: 'Demo access is turned off.' })
        const found = await ctx.context.internalAdapter.findUserByEmail(DEMO_EMAIL)
        if (!found) throw new APIError('NOT_FOUND', { message: 'The demo account has not been created.' })
        const session = await ctx.context.internalAdapter.createSession(found.user.id)
        if (!session) throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Could not create a demo session.' })
        await setSessionCookie(ctx, { session, user: found.user })
        return ctx.json({ ok: true })
      }),
    },
  }) satisfies BetterAuthPlugin
