import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: 'AgencyOS AI — AI Agency Operations Toolkit', template: '%s · AgencyOS AI' },
  description: 'Run your agency smarter. Automate website audits, proposals, client reporting and onboarding with AgencyOS AI.',
  openGraph: { type: 'website', siteName: 'AgencyOS AI', title: 'AgencyOS AI — AI Agency Operations Toolkit' },
}

export const viewport: Viewport = { themeColor: '#09090b', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
