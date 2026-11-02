import type { Metadata } from 'next'
import { ComparisonTable, CtaBand, Faq, PricingCards, SectionHeading } from '@/components/marketing/sections'

export const metadata: Metadata = { title: 'Pricing', description: 'One-time AgencyOS AI licenses for agencies: Standard, Agency and Enterprise.' }

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pt-20">
        <SectionHeading center eyebrow="Pricing" title="Simple, one-time licensing" description="Buy once for your organization. Licenses activate only after verified payment or authorized manual activation." />
        <div className="mt-12">
          <PricingCards />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-4 text-lg font-semibold">Compare plans</h2>
        <ComparisonTable />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold">Hosted service</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
              The hosted product relies on continued hosting, database and AI API services. Monthly AI and audit limits are fair-use allowances that keep the service sustainable for every customer. Bank transfer and offline purchases are supported through manual license issuance.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold">Self-hosted deployments</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
              Agencies that need to run AgencyOS on their own infrastructure can negotiate a self-hosted Enterprise agreement, including deployment support and their own AI provider keys.
            </p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <h2 className="mb-4 text-lg font-semibold">Frequently asked questions</h2>
        <Faq />
      </section>
      <CtaBand />
    </>
  )
}
