import { z } from 'zod'
import { requireTenant } from '@/lib/auth/session'
import { assertSameOrigin, errorResponse } from '@/lib/security/origin'
import { runAudit, type AuditProgress } from '@/lib/services/audits'
import { AppError, toActionError, fromPgError } from '@/lib/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const bodySchema = z.object({ url: z.string().trim().min(1).max(2048), clientId: z.uuid().nullable().optional() })

/**
 * Starts an audit and streams newline-delimited JSON progress events:
 *   {"type":"progress","step":"fetching"} … {"type":"done","id":"…"} | {"type":"error",…}
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    const ctx = await requireTenant()
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('validation', 'Enter a valid URL.')
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let open = true
        // If the browser disconnects, keep running so the audit is still saved.
        const send = (obj: unknown) => {
          if (!open) return
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`))
          } catch {
            open = false
          }
        }
        try {
          const id = await runAudit(ctx, { url: parsed.data.url, clientId: parsed.data.clientId ?? null }, (step: AuditProgress) => send({ type: 'progress', step }))
          send({ type: 'done', id })
        } catch (err) {
          const e = toActionError(fromPgError(err) ?? err)
          send({ type: 'error', error: e })
        } finally {
          if (open) {
            try {
              controller.close()
            } catch {
              /* already closed */
            }
          }
        }
      },
      cancel() {
        // Client went away; the audit continues server-side.
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (err) {
    return errorResponse(err)
  }
}
