import type { Metadata } from 'next'
import { Mail, Server, Building2 } from 'lucide-react'
import { ContactForm } from '@/components/marketing/contact-form'
import { SectionHeading } from '@/components/marketing/sections'

export const metadata: Metadata = { title: 'Contact', description: 'Talk to the AgencyOS AI team about licensing, Enterprise and self-hosted deployments.' }

const TOPICS = ['sales', 'support', 'partnership', 'self_hosted', 'other'] as const

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams
  const initialTopic = TOPICS.find((t) => t === topic) ?? 'sales'
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <SectionHeading eyebrow="Contact" title="Talk to our team" description="Questions about licensing, Enterprise terms, bank-transfer purchases or self-hosted deployments? Send us a message." />
        <div className="mt-10 space-y-6">
          {[
            [Building2, 'Enterprise & volume licensing', 'Negotiated terms, additional integrations and priority support.'],
            [Server, 'Self-hosted deployments', 'Run AgencyOS on your own infrastructure under a separate agreement.'],
            [Mail, 'Offline purchases', 'Pay by bank transfer and receive a manually issued license key.'],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Mail
            return (
              <div key={t as string} className="flex gap-3">
                <I className="mt-0.5 size-4 text-accent" aria-hidden />
                <div>
                  <p className="text-sm font-medium">{t as string}</p>
                  <p className="mt-1 text-[13px] text-fg-muted">{d as string}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
        <ContactForm initialTopic={initialTopic} />
      </div>
    </section>
  )
}
