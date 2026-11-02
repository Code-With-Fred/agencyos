'use server'
import { revalidatePath } from 'next/cache'
import { runAction } from '@/lib/action'
import { requireTenant, requireUser } from '@/lib/auth/session'
import { appUrl } from '@/lib/env'
import { formToObject, uuid } from '@/lib/validators/common'
import { inviteSchema, roleSchema } from '@/lib/validators/org'
import { acceptInvitation, changeMemberRole, createInvitation, removeMember, revokeInvitation } from '@/lib/services/team'
import { rateLimit } from '@/lib/security/rate-limit'
import { isEmailConfigured, layoutEmail, sendEmail, escapeHtml } from '@/lib/email/send'
import { cookies } from 'next/headers'
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/session'

export async function inviteMemberAction(formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await rateLimit({ key: `invite:${ctx.orgId}`, limit: 30, windowSeconds: 3600 })
    const input = inviteSchema.parse(formToObject(formData))
    const sendNow = formData.get('sendEmail') === 'on'
    const { token } = await createInvitation(ctx, input)
    const link = `${appUrl()}/invite/${token}`
    let emailed = false
    if (sendNow && isEmailConfigured()) {
      await sendEmail({
        to: input.email,
        subject: `You're invited to join ${ctx.org.name} on AgencyOS AI`,
        text: `${ctx.user.name} invited you to join ${ctx.org.name} as ${input.role}.\n\nAccept the invitation (valid for 7 days): ${link}`,
        html: layoutEmail(`Join ${ctx.org.name}`, `<p>${escapeHtml(ctx.user.name)} invited you to join <strong>${escapeHtml(ctx.org.name)}</strong> as ${input.role}.</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Accept invitation</a></p><p style="color:#71717a;font-size:13px">This link expires in 7 days.</p>`),
      })
      emailed = true
    }
    revalidatePath('/app/team')
    return { link, emailed }
  })
}

export async function revokeInvitationAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await revokeInvitation(ctx, uuid.parse(id))
    revalidatePath('/app/team')
    return null
  })
}

export async function changeRoleAction(memberId: string, role: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await changeMemberRole(ctx, uuid.parse(memberId), roleSchema.parse(role))
    revalidatePath('/app/team')
    return null
  })
}

export async function removeMemberAction(memberId: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await removeMember(ctx, uuid.parse(memberId))
    revalidatePath('/app', 'layout')
    return null
  })
}

export async function acceptInvitationAction(token: string) {
  return runAction(async () => {
    const user = await requireUser()
    await rateLimit({ key: `accept-invite:${user.id}`, limit: 20, windowSeconds: 3600 })
    const orgId = await acceptInvitation(user.id, token)
    ;(await cookies()).set(ACTIVE_ORG_COOKIE, orgId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
    revalidatePath('/app', 'layout')
    return { orgId }
  })
}
