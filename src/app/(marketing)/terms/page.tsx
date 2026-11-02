import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal'

export const metadata: Metadata = { title: 'Terms of service' }

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="November 2, 2026"
      sections={[
        { heading: 'Agreement', body: ['These terms govern access to AgencyOS AI provided by [Company legal name]. By creating an account or activating a license you agree to these terms on behalf of yourself and your organization.'] },
        {
          heading: 'Licenses',
          body: [
            'Licenses are sold as one-time purchases for a single organization unless otherwise agreed in writing. A license becomes active only after verified payment confirmation or authorized manual activation by us.',
            'Licenses are non-transferable without our consent. We may suspend or revoke a license for non-payment, chargebacks, abuse or material breach of these terms.',
            'Where an order form specifies an expiry date or term, the license ends on that date.',
          ],
        },
        {
          heading: 'Hosted service',
          body: [
            'The hosted Service depends on continued hosting, database and third-party AI API services. Usage is subject to the fair-use limits shown in the product (for example monthly AI generations and audits). We may adjust limits with reasonable notice to keep the Service sustainable.',
            'If we discontinue the hosted Service, we will provide reasonable notice and an opportunity to export your data.',
          ],
        },
        { heading: 'Self-hosted deployments', body: ['Self-hosted deployments are available only under a separately negotiated agreement, which takes precedence over these terms where they conflict.'] },
        {
          heading: 'Acceptable use',
          body: [
            'You may only audit websites you own or are authorized to assess. You must not use the Service to attack, scan or overload systems, to circumvent access controls, or to generate unlawful, misleading or infringing content.',
          ],
        },
        {
          heading: 'AI-generated content',
          body: [
            'AI output may be inaccurate or incomplete. You are responsible for reviewing all generated content before sending it to clients. Measured audit findings are produced by automated checks and may not reflect every condition of a website; items marked as estimates are approximations.',
          ],
        },
        { heading: 'Customer content', body: ['You retain ownership of your content. You grant us a limited right to process it solely to provide the Service.'] },
        { heading: 'Payments and refunds', body: ['Payments are processed by Stripe or by bank transfer. Refund terms: [insert policy].'] },
        { heading: 'Warranties and liability', body: ['The Service is provided "as is" to the extent permitted by law. We do not guarantee specific business outcomes such as rankings, traffic or revenue. Our aggregate liability is limited to the amount you paid for the license in the 12 months preceding the claim. [Adapt to your jurisdiction.]'] },
        { heading: 'Governing law', body: ['These terms are governed by the laws of [jurisdiction], and disputes are subject to the exclusive jurisdiction of the courts of [venue].'] },
      ]}
    />
  )
}
