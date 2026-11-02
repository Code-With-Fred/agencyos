/** Only same-site relative paths are allowed as post-auth redirects. */
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || typeof next !== 'string') return fallback
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.includes('://')) return fallback
  return next
}
