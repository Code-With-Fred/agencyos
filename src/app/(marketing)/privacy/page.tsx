import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/legal'

export const metadata: Metadata = { title: 'Privacy policy' }

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="November 2, 2026"
      sections={[
        { heading: 'Who we are', body: ['[Company legal name] ("we", "us") operates AgencyOS AI (the "Service"). This policy explains how we collect, use and protect personal data when you use the Service. Contact: [privacy contact email].'] },
        {
          heading: 'Data we collect',
          body: [
            'Account data: name, email address and a securely hashed password.',
            'Organization data: organization profile, branding assets and team membership.',
            'Customer content: client records, projects, audits, proposals, reports and onboarding documents that you create. You are the controller of personal data contained in customer content; we process it on your behalf.',
            'Technical data: IP address, user agent and session information used for security, rate limiting and abuse prevention.',
          ],
        },
        {
          heading: 'How we use data',
          body: [
            'To provide and secure the Service, authenticate users, enforce organization access controls, process license payments, provide support and comply with legal obligations.',
            'When you use AI features, the relevant input (for example, measured website findings or the project brief you enter) is sent to our AI provider (Google Gemini API) to generate a response. Do not include sensitive personal data in AI inputs.',
          ],
        },
        {
          heading: 'Sub-processors',
          body: ['We use infrastructure and service providers including Vercel (hosting), Supabase (database and file storage), Google (Gemini API and optional PageSpeed Insights), Stripe (payments) and an email delivery provider. [List sub-processors, locations and safeguards.]'],
        },
        { heading: 'Website audits', body: ['The audit feature fetches publicly accessible web pages that you submit. It does not execute JavaScript, log in, or access non-public resources.'] },
        { heading: 'Retention', body: ['We retain customer content for as long as your organization uses the Service and for [period] after termination, unless a longer period is required by law. You may request deletion at any time.'] },
        { heading: 'Your rights', body: ['Depending on your location, you may have rights to access, correct, delete, restrict or port your personal data and to object to processing. Contact [privacy contact email] to exercise them. You may also lodge a complaint with your supervisory authority.'] },
        { heading: 'Security', body: ['We use encryption in transit, hashed passwords and tokens, role-based access, database row-level security and audit logging. No system is perfectly secure; we will notify affected customers of breaches as required by law.'] },
        { heading: 'International transfers', body: ['Where data is transferred outside your jurisdiction we rely on appropriate safeguards such as Standard Contractual Clauses. [Adapt to your setup.]'] },
        { heading: 'Changes', body: ['We may update this policy and will notify account owners of material changes.'] },
      ]}
    />
  )
}
