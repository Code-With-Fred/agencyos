import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { CtaBand, MODULES, SectionHeading } from '@/components/marketing/sections'

export const metadata: Metadata = { title: 'Features', description: 'AI website audits, proposals, white-label reporting and client onboarding for agencies.' }

const details: Record<string, { how: string[]; note: string }> = {
  'AI Website Audit Generator': {
    how: [
      'Fetches the page server-side with strict SSRF protection — no site JavaScript is executed.',
      'Checks title, meta description, canonical, robots directives, robots.txt, sitemap, HTTPS, heading structure and a sample of internal links.',
      'Measures HTML size, asset counts, render-blocking resources, compression and image weight from response headers.',
      'Evaluates image alt text, form labels, heading hierarchy, landmarks and viewport configuration.',
      'Looks for contact options, calls to action and navigation structure.',
      'Optionally adds Google PageSpeed Insights lab data and Chrome UX Report field data.',
    ],
    note: 'Gemini receives only the measured findings and writes plain-English explanations, priorities and next steps. Scores come from documented rules, not from the AI.',
  },
  'AI Proposal Generator': {
    how: [
      'Enter the client, project description, requirements, services, deliverables, budget, timeline and payment terms.',
      'Generates executive summary, client challenges, solution, scope, deliverables, timeline, pricing, terms and next steps.',
      'Edit any section, regenerate one section at a time, duplicate proposals and switch templates.',
      'Pricing is allocated only from the budget you enter — never invented.',
    ],
    note: 'Prompts instruct the model not to invent credentials, testimonials, case studies or guarantees.',
  },
  'White-Label Client Reporting': {
    how: [
      'Select a client and reporting period; attach a website audit and project progress from your workspace.',
      'Add metrics you have verified yourself, with their source.',
      'Generate an executive summary from that data, then customize, reorder or hide sections.',
      'Export branded PDFs or share a link with optional expiry that you can revoke at any time.',
    ],
    note: 'Metrics are always labelled as provided by your team. AgencyOS does not fetch traffic or ranking data it cannot verify.',
  },
  'AI Client Onboarding Generator': {
    how: [
      'Select a client and project type, then describe requirements.',
      'Generate welcome emails, questionnaires, requirement documents, onboarding checklists, required asset lists, kickoff agendas and communication guidelines.',
      'Edit, save and export each document; tick off checklist items to track onboarding progress.',
      'Send the welcome email only when you explicitly choose to, through your configured email provider.',
    ],
    note: 'Nothing is ever emailed to a client automatically.',
  },
}

export default function FeaturesPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-16 sm:px-6 sm:pt-20">
        <SectionHeading eyebrow="Features" title="Everything in AgencyOS AI" description="Four AI-assisted modules on top of client management, projects, team collaboration and branding." />
      </section>
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-20 sm:px-6">
        {MODULES.map((m) => (
          <section key={m.name} className="grid gap-8 rounded-xl border border-border bg-surface p-6 sm:p-8 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <m.icon className="size-6 text-accent" aria-hidden />
              <h2 className="mt-4 text-xl font-semibold tracking-tight">{m.name}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{m.summary}</p>
              <p className="mt-5 rounded-md border border-border bg-elevated px-3 py-2.5 text-[13px] leading-relaxed text-fg-muted">{details[m.name].note}</p>
            </div>
            <ul className="space-y-3">
              {details[m.name].how.map((h) => (
                <li key={h} className="flex gap-3 text-[14px] leading-relaxed text-fg-muted">
                  <Check className="mt-1 size-4 shrink-0 text-accent" aria-hidden /> {h}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="grid gap-4 pt-6 md:grid-cols-3">
          {[
            ['Client & project management', 'Client records with status, notes and full history; projects with budgets, deadlines, tasks, assignments and internal notes.'],
            ['Team collaboration', 'Owner, Admin and Member roles, expiring invitation links, organization switching and an activity log.'],
            ['Branding & white-label', 'Logo, brand and accent colors, contact details, report footer and default report titles applied to every export.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold">{t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{d}</p>
            </div>
          ))}
        </section>
      </div>
      <CtaBand />
    </>
  )
}
