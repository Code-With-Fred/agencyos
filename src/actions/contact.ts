'use server'
import { headers } from 'next/headers'
import { runAction } from '@/lib/action'
import { withSystem } from '@/lib/db'
import { contactSchema, formToObject } from '@/lib/validators/common'
import { rateLimit, clientIp } from '@/lib/security/rate-limit'
import { env } from '@/lib/env'
import { isEmailConfigured, sendEmail, layoutEmail, textToHtml } from '@/lib/email/send'

export async function submitContact(formData: FormData) {
  return runAction(async () => {
    const input = contactSchema.parse(formToObject(formData))
    const ip = clientIp(await headers())
    await rateLimit({ key: `contact:${ip}`, limit: 5, windowSeconds: 3600, message: 'Too many messages from this network. Please try again later.' })
    await withSystem((tx) =>
      tx.insertInto('contact_submissions').values({ name: input.name, email: input.email, company: input.company, topic: input.topic, message: input.message }).execute(),
    )
    const inbox = env().CONTACT_INBOX_EMAIL
    if (inbox && isEmailConfigured()) {
      const text = `From: ${input.name} <${input.email}>\nCompany: ${input.company ?? '—'}\nTopic: ${input.topic}\n\n${input.message}`
      await sendEmail({ to: inbox, subject: `New ${input.topic} enquiry from ${input.name}`, text, html: layoutEmail('New enquiry', textToHtml(text)), replyTo: input.email }).catch(() => undefined)
    }
    return { received: true }
  })
}
