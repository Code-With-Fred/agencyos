import 'server-only'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors'

export function isEmailConfigured(): boolean {
  const e = env()
  return Boolean(e.RESEND_API_KEY && e.EMAIL_FROM)
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** Plain text -> minimal safe HTML (paragraphs + line breaks, escaped). */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

export function layoutEmail(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">
<div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:32px">
<h1 style="font-size:18px;margin:0 0 20px">${escapeHtml(title)}</h1>${bodyHtml}</div></body></html>`
}

type SendInput = { to: string; subject: string; html: string; text: string; replyTo?: string }

/**
 * Sends a transactional email through Resend's HTTP API. Throws
 * `not_configured` when no provider is set up — callers must surface that
 * honestly instead of reporting success.
 */
export async function sendEmail(input: SendInput): Promise<{ id: string }> {
  const e = env()
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM) {
    throw new AppError('not_configured', 'Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.')
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: e.EMAIL_FROM, to: [input.to], subject: input.subject, html: input.html, text: input.text, reply_to: input.replyTo }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    console.error('[email] provider rejected message', res.status)
    throw new AppError('upstream_failed', 'The email provider rejected the message. Check your email configuration.')
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string }
  return { id: body.id ?? 'unknown' }
}
