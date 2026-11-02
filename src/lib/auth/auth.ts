import 'server-only'
import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { env, appUrl } from '@/lib/env'
import { getPool } from '@/lib/db/pool'
import { isEmailConfigured, layoutEmail, sendEmail, escapeHtml } from '@/lib/email/send'

function createAuth() {
  const e = env()
  return betterAuth({
    appName: 'AgencyOS AI',
    baseURL: e.BETTER_AUTH_URL ?? appUrl(),
    secret: e.BETTER_AUTH_SECRET,
    database: getPool(),
    trustedOrigins: [appUrl()],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        if (!isEmailConfigured()) {
          // Never claim an email was sent. In development the link is printed
          // to the server console so the flow can be tested locally.
          if (e.NODE_ENV !== 'production') console.info(`[auth] password reset link for ${user.email}: ${url}`)
          else console.error('[auth] password reset requested but email delivery is not configured')
          return
        }
        await sendEmail({
          to: user.email,
          subject: 'Reset your AgencyOS AI password',
          text: `Use this link to reset your password (valid for 1 hour): ${url}\n\nIf you did not request this, you can ignore this email.`,
          html: layoutEmail(
            'Reset your password',
            `<p>Use the button below to choose a new password. The link is valid for one hour.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Reset password</a></p>
<p style="color:#71717a;font-size:13px">If you did not request this, you can ignore this email.</p>`,
          ),
        })
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 15,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60 * 60, max: 10 },
        '/request-password-reset': { window: 60 * 60, max: 5 },
        '/change-password': { window: 60 * 10, max: 5 },
      },
    },
    advanced: {
      // Enforce Origin/CSRF validation in every environment. Better Auth
      // otherwise skips it when NODE_ENV=test.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: e.NODE_ENV === 'production',
      cookiePrefix: 'agencyos',
      ipAddress: { ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'] },
    },
    plugins: [nextCookies()],
  })
}

type Auth = ReturnType<typeof createAuth>
const g = globalThis as unknown as { __agencyosAuth?: Auth }

/** Lazily constructed so builds do not require secrets. */
export function getAuth(): Auth {
  if (!g.__agencyosAuth) g.__agencyosAuth = createAuth()
  return g.__agencyosAuth
}
