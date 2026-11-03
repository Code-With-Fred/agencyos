import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { isPreviewMode } from '@/lib/preview'

/**
 * Optimistic route guard: redirects requests without a session cookie away
 * from the app. Real session validation happens server-side in every layout,
 * page, server action and route handler (lib/auth/session.ts).
 */
export function proxy(request: NextRequest) {
  if (isPreviewMode()) return NextResponse.next()
  const cookie = getSessionCookie(request, { cookiePrefix: 'agencyos' })
  if (!cookie) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/app/:path*'] }
