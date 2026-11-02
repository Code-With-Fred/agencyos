import Link from 'next/link'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6', className)} aria-hidden fill="none">
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#16161b" stroke="#31313a" />
      <path d="M7 16.5 11.2 7h1.6L17 16.5" stroke="#ededf0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.9 13h6.2" stroke="#6d6af5" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2 font-semibold tracking-tight text-fg', className)}>
      <LogoMark />
      <span className="text-[15px]">
        AgencyOS <span className="text-fg-muted">AI</span>
      </span>
    </Link>
  )
}
