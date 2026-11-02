import type { Metadata } from 'next'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { requireOrgContext } from '@/lib/auth/session'
import { integrationStatus } from '@/lib/env'

export const metadata: Metadata = { title: 'Integrations' }

export default async function IntegrationsPage() {
  await requireOrgContext()
  const s = integrationStatus()
  const items = [
    { name: 'Google Gemini API', ok: s.gemini, purpose: 'AI explanations for audits, proposal drafting, report summaries and onboarding documents.', vars: ['GEMINI_API_KEY', 'GEMINI_MODEL'], without: 'Audits still produce measured findings and rule-based scores; AI generation is disabled.' },
    { name: 'Google PageSpeed Insights', ok: s.pagespeed, purpose: 'Lighthouse lab performance data and Chrome UX Report field data (Core Web Vitals) when available.', vars: ['PAGESPEED_API_KEY'], without: 'Core Web Vitals are reported as "not measured" — never estimated.' },
    { name: 'Supabase Storage', ok: s.storage, purpose: 'Secure storage for organization logos used in branded exports.', vars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], without: 'Logo uploads are unavailable; exports use your company name instead.' },
    { name: 'Email delivery (Resend)', ok: s.email, purpose: 'Password reset emails, team invitations and explicitly-sent client welcome emails.', vars: ['RESEND_API_KEY', 'EMAIL_FROM'], without: 'Invitation links can still be copied and shared manually. No email is ever sent automatically to clients.' },
    { name: 'Stripe', ok: s.stripe && s.stripePrices, purpose: 'One-time license purchases through Stripe Checkout with verified webhooks.', vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_STANDARD', 'STRIPE_PRICE_AGENCY'], without: 'Online checkout is unavailable; licenses can be issued manually by a platform administrator.' },
    { name: 'License key encryption', ok: s.licensing, purpose: 'Hashing and encryption of license keys.', vars: ['LICENSE_SECRET'], without: 'License issuance and activation are unavailable.' },
  ]
  return (
    <PageContainer>
      <PageHeader title="Integrations" description="Status of the external services this deployment is connected to. Credentials are configured by the operator as server environment variables and are never shown here." />
      <div className="grid gap-3">
        {items.map((i) => (
          <Card key={i.name} className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              {i.ok ? <CheckCircle2 className="mt-0.5 size-5 text-success" aria-hidden /> : <CircleDashed className="mt-0.5 size-5 text-fg-subtle" aria-hidden />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{i.name}</h2>
                  <span className={`text-2xs font-medium ${i.ok ? 'text-success' : 'text-warning'}`}>{i.ok ? 'Connected' : 'Not configured'}</span>
                </div>
                <p className="mt-1 text-[13px] text-fg-muted">{i.purpose}</p>
                {!i.ok ? <p className="mt-2 text-xs text-fg-subtle">Without it: {i.without}</p> : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {i.vars.map((v) => (
                    <code key={v} className="rounded border border-border-strong px-1.5 py-0.5 font-mono text-2xs text-fg-muted">
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  )
}
