import { ZodError } from 'zod'

export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'not_configured'
  | 'conflict'
  | 'limit_reached'
  | 'ai_failed'
  | 'upstream_failed'
  | 'internal'

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 422,
  rate_limited: 429,
  not_configured: 503,
  conflict: 409,
  limit_reached: 402,
  ai_failed: 502,
  upstream_failed: 502,
  internal: 500,
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly fieldErrors?: Record<string, string[]>
  readonly retryAfter?: number

  constructor(code: ErrorCode, message: string, opts: { fieldErrors?: Record<string, string[]>; retryAfter?: number; cause?: unknown } = {}) {
    super(message, { cause: opts.cause })
    this.name = 'AppError'
    this.code = code
    this.status = STATUS[code]
    this.fieldErrors = opts.fieldErrors
    this.retryAfter = opts.retryAfter
  }
}

export type ActionError = { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> }
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError }

export function zodFieldErrors(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_form'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

/** Normalizes any thrown value into a safe, user-presentable error. */
export function toActionError(err: unknown): ActionError {
  if (err instanceof AppError) return { code: err.code, message: err.message, fieldErrors: err.fieldErrors }
  if (err instanceof ZodError) return { code: 'validation', message: 'Please correct the highlighted fields.', fieldErrors: zodFieldErrors(err) }
  console.error('[unexpected]', err instanceof Error ? `${err.name}: ${err.message}` : 'non-error thrown')
  return { code: 'internal', message: 'Something went wrong. Please try again.' }
}

/** Maps Postgres errors raised by our SQL functions / constraints to AppErrors. */
export function fromPgError(err: unknown): AppError | null {
  if (!err || typeof err !== 'object') return null
  const e = err as { code?: string; message?: string; constraint?: string }
  if (e.code === '42501' || e.message?.includes('row-level security')) return new AppError('forbidden', 'You do not have permission to perform this action.')
  if (e.code === '23505') return new AppError('conflict', 'A record with these details already exists.')
  if (e.code === '23503') return new AppError('validation', 'A referenced record does not exist in this organization.')
  if (e.code === '23514') return new AppError('validation', 'One or more values are invalid.')
  if (e.code === 'P0001' && e.message) {
    const map: Record<string, string> = {
      organization_limit_reached: 'You have reached the maximum number of organizations you can own.',
      invitation_invalid: 'This invitation is no longer valid.',
      invitation_expired: 'This invitation has expired. Ask an administrator for a new one.',
      invitation_email_mismatch: 'This invitation was sent to a different email address. Sign in with the invited email.',
      already_member: 'You are already a member of this organization.',
    }
    if (map[e.message]) return new AppError(e.message === 'organization_limit_reached' ? 'limit_reached' : 'conflict', map[e.message])
  }
  return null
}
