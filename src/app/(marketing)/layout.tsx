import Link from 'next/link'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { MobileNav } from '@/components/marketing/mobile-nav'

const nav = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/contact', label: 'Contact' },
]

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="text-[13px] text-fg-muted transition-colors hover:text-fg">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
          <MobileNav items={nav} />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-fg-muted">
              The operations toolkit for SEO, digital marketing and web development agencies. Audits, proposals, reporting and onboarding in one workspace.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-fg">Product</p>
            <ul className="mt-3 space-y-2 text-[13px] text-fg-muted">
              <li><Link href="/features" className="hover:text-fg">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-fg">Pricing</Link></li>
              <li><Link href="/login" className="hover:text-fg">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-fg">Company</p>
            <ul className="mt-3 space-y-2 text-[13px] text-fg-muted">
              <li><Link href="/contact" className="hover:text-fg">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-fg">Privacy policy</Link></li>
              <li><Link href="/terms" className="hover:text-fg">Terms of service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-fg-subtle sm:px-6">© {new Date().getFullYear()} AgencyOS AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
