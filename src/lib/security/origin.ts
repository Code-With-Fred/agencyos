import 'server-only'
import { appUrl } from '@/lib/env'
import { AppError } from '@/lib/errors'

/**
 * CSRF protection for cookie-authenticated route handlers. Server actions get
 * Next.js's built-in Origin check; route handlers call this explicitly.
 */
export function assertSameOrigin(req: Request): void {
  const expected = new URL(appUrl()).origin
  const origin = req.headers.get('origin')
  if (origin) {
    if (origin !== expected) throw new AppError('forbidden', 'Cross-origin request rejected.')
    return
  }
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') throw new AppError('forbidden', 'Cross-origin request rejected.')
  if (!site) throw new AppError('forbidden', 'Missing Origin header.')
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {}
    if (err.retryAfter) headers['Retry-After'] = String(err.retryAfter)
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status, headers })
  }
  console.error('[api] unexpected error', err instanceof Error ? err.message : err)
  return Response.json({ error: { code: 'internal', message: 'Something went wrong.' } }, { status: 500 })
}
