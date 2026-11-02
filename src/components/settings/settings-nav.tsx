'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/app/settings', label: 'Profile' },
  { href: '/app/settings/organization', label: 'Organization' },
  { href: '/app/settings/security', label: 'Security' },
  { href: '/app/settings/ai', label: 'AI configuration' },
  { href: '/app/settings/license', label: 'License' },
  { href: '/app/branding', label: 'Branding' },
  { href: '/app/team', label: 'Team' },
  { href: '/app/integrations', label: 'Integrations' },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Settings" className="flex gap-1 overflow-x-auto border-b border-border pb-px scrollbar-thin lg:flex-col lg:border-0 lg:pb-0">
      {ITEMS.map((i) => {
        const active = pathname === i.href
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined} className={cn('whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px]', active ? 'bg-hover text-fg' : 'text-fg-muted hover:text-fg')}>
            {i.label}
          </Link>
        )
      })}
    </nav>
  )
}
