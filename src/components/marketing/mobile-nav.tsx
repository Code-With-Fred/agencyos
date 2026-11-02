'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="md:hidden">
      <Button variant="ghost" size="icon-sm" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <X /> : <Menu />}
      </Button>
      {open ? (
        <div className="absolute inset-x-0 top-14 border-b border-border bg-bg px-4 py-4">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {items.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm text-fg-muted hover:bg-hover hover:text-fg">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button asChild variant="secondary"><Link href="/login">Sign in</Link></Button>
            <Button asChild><Link href="/register">Get started</Link></Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
