import { z } from 'zod'
import { createCheckoutSession } from '@/lib/payments/stripe'
import { assertSameOrigin, errorResponse } from '@/lib/security/origin'
import { clientIp, rateLimit } from '@/lib/security/rate-limit'
import { getSessionUser } from '@/lib/auth/session'
import { AppError } from '@/lib/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    await rateLimit({ key: `checkout:${clientIp(req.headers)}`, limit: 10, windowSeconds: 600 })
    const body = z.object({ plan: z.enum(['standard', 'agency']) }).safeParse(await req.json().catch(() => null))
    if (!body.success) throw new AppError('validation', 'Unknown plan.')
    const user = await getSessionUser().catch(() => null)
    const url = await createCheckoutSession(body.data.plan, user?.email)
    return Response.json({ url })
  } catch (err) {
    return errorResponse(err)
  }
}
