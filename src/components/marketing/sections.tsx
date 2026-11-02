import Link from 'next/link'
import { Check, ClipboardList, FileSignature, LineChart, ScanSearch, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS, MODULE_LABELS, type Module } from '@/lib/licensing/plans'
import { FadeIn } from './fade-in'
import { BuyButton } from './buy-button'

export const MODULES = [
  {
    icon: ScanSearch,
    name: 'AI Website Audit Generator',
    summary: 'Inspect any public website server-side and turn measured findings into a prioritized, client-ready audit.',
    points: ['Technical SEO, content, performance, accessibility and UX checks', 'Transparent, rule-based scoring', 'Optional PageSpeed Insights field data', 'Branded PDF export'],
  },
  {
    icon: FileSignature,
    name: 'AI Proposal Generator',
    summary: 'Turn a project brief into a structured consulting proposal you can edit section by section.',
    points: ['Executive summary, scope, timeline and pricing', 'Regenerate any single section', 'Three professional templates', 'Duplicate, preview and export'],
  },
  {
    icon: LineChart,
    name: 'White-Label Client Reporting',
    summary: 'Combine audits, project progress and verified metrics into reports under your own brand.',
    points: ['Your logo, colors, footer and contact details', 'AI executive summaries from your data', 'Secure, revocable share links', 'Customizable sections'],
  },
  {
    icon: ClipboardList,
    name: 'AI Client Onboarding Generator',
    summary: 'Generate the documents every engagement starts with, then track onboarding progress.',
    points: ['Welcome emails and questionnaires', 'Requirement docs and kickoff agendas', 'Checklists and required-asset lists', 'Progress tracking per client'],
  },
]

export function SectionHeading({ eyebrow, title, description, center }: { eyebrow?: string; title: string; description?: string; center?: boolean }) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">{eyebrow}</p> : null}
      <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">{description}</p> : null}
    </div>
  )
}

export function ModuleGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
      {MODULES.map((m, i) => (
        <FadeIn key={m.name} delay={i * 0.05} className="bg-surface p-6 sm:p-8">
          <m.icon className="size-5 text-accent" aria-hidden />
          <h3 className="mt-4 text-base font-semibold text-fg">{m.name}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{m.summary}</p>
          <ul className="mt-4 space-y-1.5">
            {m.points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px] text-fg-muted">
                <Check className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        </FadeIn>
      ))}
    </div>
  )
}

export function PricingCards() {
  const plans = [PLANS.standard, PLANS.agency, PLANS.enterprise]
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {plans.map((p) => {
        const featured = p.id === 'agency'
        return (
          <div key={p.id} className={`flex flex-col rounded-xl border p-6 ${featured ? 'border-accent/50 bg-elevated shadow-[0_0_0_1px_rgba(109,106,245,0.25)]' : 'border-border bg-surface'}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg">{p.name}</h3>
              {featured ? <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-2xs font-medium text-[#a9a7ff]">Most popular</span> : null}
            </div>
            <p className="mt-2 min-h-10 text-[13px] text-fg-muted">{p.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1.5">
              {p.priceUsd !== null ? (
                <>
                  <span className="text-3xl font-semibold tracking-tight text-fg">${p.priceUsd.toLocaleString('en-US')}</span>
                  <span className="text-xs text-fg-subtle">one-time license</span>
                </>
              ) : (
                <span className="text-3xl font-semibold tracking-tight text-fg">Custom</span>
              )}
            </div>
            <ul className="mt-6 flex-1 space-y-2">
              {p.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-[13px] text-fg-muted">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden /> {h}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {p.purchasable ? (
                <BuyButton plan={p.id as 'standard' | 'agency'} variant={featured ? 'primary' : 'secondary'} />
              ) : (
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/contact?topic=sales">Contact sales</Link>
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ComparisonTable() {
  const plans = [PLANS.standard, PLANS.agency, PLANS.enterprise]
  const rows: { label: string; values: (string | boolean)[] }[] = [
    ...(Object.keys(MODULE_LABELS) as Module[]).map((m) => ({ label: MODULE_LABELS[m], values: plans.map((p) => p.modules.includes(m)) })),
    { label: 'White-label reports', values: plans.map((p) => p.whiteLabel) },
    { label: 'Team members', values: plans.map((p) => (p.id === 'enterprise' ? 'Custom' : String(p.maxMembers))) },
    { label: 'AI generations / month (fair use)', values: plans.map((p) => (p.id === 'enterprise' ? 'Custom' : p.aiGenerationsPerMonth.toLocaleString('en-US'))) },
    { label: 'Website audits / month', values: plans.map((p) => (p.id === 'enterprise' ? 'Custom' : p.auditsPerMonth.toLocaleString('en-US'))) },
    { label: 'Organizations', values: ['1', '1', 'Negotiated'] },
    { label: 'Priority support', values: [false, false, true] },
    { label: 'Self-hosted deployment option', values: [false, false, 'Negotiated'] },
  ]
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th className="px-4 py-3 text-left font-medium text-fg-muted">Capability</th>
            {plans.map((p) => (
              <th key={p.id} className="px-4 py-3 text-left font-semibold text-fg">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-fg-muted">{r.label}</td>
              {r.values.map((v, i) => (
                <td key={i} className="px-4 py-3 text-fg">
                  {v === true ? <Check className="size-4 text-accent" aria-label="Included" /> : v === false ? <Minus className="size-4 text-fg-subtle" aria-label="Not included" /> : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const FAQS = [
  {
    q: 'Is this a subscription?',
    a: 'No. Licenses are one-time purchases for a single organization. Because the hosted product depends on continued hosting, database and AI API services, the hosted service is provided under the terms of service and fair-use limits shown on this page.',
  },
  {
    q: 'Are the audit scores real?',
    a: 'Every finding comes from deterministic checks our server runs against the live page, robots.txt and sitemap. The score is calculated from transparent, documented rules. The AI explains and prioritizes findings — it never invents measurements, traffic, rankings or backlinks.',
  },
  {
    q: 'Do you provide Core Web Vitals?',
    a: 'Only when they are available from a supported data source. If a Google PageSpeed Insights API key is configured, the audit includes PageSpeed lab data and Chrome UX Report field data when Google has it for the URL. Otherwise these sections are clearly marked as not measured.',
  },
  {
    q: 'Can I put my own brand on reports?',
    a: 'Yes, on the Agency and Enterprise plans. Reports and PDF exports use your logo, colors, contact details and footer, and can be shared with clients through secure links you can revoke at any time.',
  },
  {
    q: 'Who can see my client data?',
    a: 'Only members of your organization. Tenant isolation is enforced in application code and again at the database level with row-level security policies.',
  },
  {
    q: 'Can we self-host AgencyOS?',
    a: 'Self-hosted deployments are available under separately negotiated Enterprise agreements. Contact sales to discuss requirements.',
  },
]

export function Faq() {
  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {FAQS.map((f) => (
        <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-fg">
            {f.q}
            <span className="text-fg-subtle transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">{f.a}</p>
        </details>
      ))}
    </div>
  )
}

export function CtaBand() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-surface px-6 py-14 text-center sm:px-12">
          <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
          <h2 className="relative text-balance text-2xl font-semibold tracking-tight sm:text-3xl">Spend your time on client work, not paperwork.</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[15px] text-fg-muted">Create your workspace, run your first audit and generate your first proposal in minutes.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Create your workspace</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
