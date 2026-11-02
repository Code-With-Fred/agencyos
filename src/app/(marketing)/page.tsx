import Link from 'next/link'
import { ArrowRight, Building2, Clock, FileCheck2, Layers, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductPreview } from '@/components/marketing/product-preview'
import { FadeIn } from '@/components/marketing/fade-in'
import { CtaBand, Faq, ModuleGrid, PricingCards, SectionHeading } from '@/components/marketing/sections'

const steps = [
  { n: '01', title: 'Add a client', body: 'Create the client record once. Audits, proposals, reports and onboarding documents attach to it automatically.' },
  { n: '02', title: 'Run an audit or write a brief', body: 'Enter a URL and AgencyOS inspects the live site, or enter project details and generate a structured proposal.' },
  { n: '03', title: 'Review and edit', body: 'Every AI-generated section is editable. Measured findings stay separate from AI explanations so you always know the source.' },
  { n: '04', title: 'Deliver under your brand', body: 'Export branded PDFs or share a secure, revocable link with your client.' },
]

const benefits = [
  { icon: Clock, title: 'Hours back every week', body: 'Automate the first draft of audits, proposals, reports and onboarding packs so your team starts from 80%, not zero.' },
  { icon: FileCheck2, title: 'Evidence-based deliverables', body: 'Findings come from deterministic checks with the evidence attached. The AI explains them — it never fabricates metrics.' },
  { icon: Layers, title: 'Consistent quality', body: 'Templates and structured outputs mean every client gets the same professional standard, whoever prepares it.' },
  { icon: Building2, title: 'Built for multiple teams', body: 'Separate organizations, roles and permissions for owners, admins and members, with organization switching.' },
  { icon: Lock, title: 'Tenant isolation by design', body: 'Every record is scoped to an organization and protected with database row-level security.' },
  { icon: ShieldCheck, title: 'Safe website inspection', body: 'Audits run server-side without executing site JavaScript, with SSRF protection, timeouts and size limits.' },
]

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center animate-in fade-in slide-in-from-bottom-2 duration-700">
            <Link href="/features" className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs text-fg-muted hover:text-fg">
              <span className="size-1.5 rounded-full bg-accent" /> Audits · Proposals · Reporting · Onboarding
              <ArrowRight className="size-3" aria-hidden />
            </Link>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-fg sm:text-6xl">Run your agency smarter.</h1>
            <p className="mx-auto mt-3 max-w-2xl text-balance text-xl text-fg-muted sm:text-2xl">Automate the work that slows you down.</p>
            <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-fg-muted">
              AgencyOS AI helps SEO, digital marketing and web development agencies automate website audits, client proposals, white-label reporting and client onboarding — in one secure workspace.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  Create your workspace <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/features">Explore the modules</Link>
              </Button>
            </div>
          </div>
          <div className="mx-auto mt-16 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <ProductPreview />
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="The toolkit" title="Four modules for the work every client needs" description="Each module produces a real, editable deliverable backed by your organization's data." />
          <div className="mt-10">
            <ModuleGrid />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="How it works" title="From client record to finished deliverable" />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {steps.map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.06} className="rounded-xl border border-border bg-surface p-5">
                <p className="font-mono text-xs text-accent">{s.n}</p>
                <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{s.body}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Benefits" title="Operational leverage without cutting corners" />
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title}>
                <b.icon className="size-5 text-fg-muted" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">{b.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{b.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-fg-subtle">Time savings depend on your workflows and how much editing your team applies. We do not guarantee specific business results.</p>
        </div>
      </section>

      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Pricing" title="One-time licenses. No per-seat subscriptions." description="Choose the plan that fits your agency. Hosted service is provided under fair-use limits." />
          <div className="mt-10">
            <PricingCards />
          </div>
          <div className="mt-6 text-center">
            <Link href="/pricing" className="text-[13px] text-accent hover:text-accent-hover">
              Compare plans in detail →
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading eyebrow="FAQ" title="Questions agency owners ask" description="Can't find what you need? Contact our team." />
          <Faq />
        </div>
      </section>
      <CtaBand />
    </>
  )
}
