'use client'
import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Check, ChevronsUpDown, Lock, LogOut, Menu, Plus, Search, UserRound, X } from 'lucide-react'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Avatar, Kbd } from '@/components/ui/page'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { toast } from '@/components/ui/toaster'
import { authClient } from '@/lib/auth/auth-client'
import { switchOrganization } from '@/actions/org'
import { cn, formatRelative } from '@/lib/utils'
import type { Module } from '@/lib/licensing/plans'
import { NAV_ADMIN, NAV_MAIN, NAV_ORG, type NavItem } from './nav'
import { CommandMenu } from './command-menu'

export type ShellProps = {
  user: { name: string; email: string }
  org: { id: string; name: string; role: string; brandColor: string }
  memberships: { orgId: string; name: string; role: string }[]
  planName: string
  modules: Module[]
  isPlatformAdmin: boolean
  notifications: { id: string; summary: string; created_at: string; actorName: string | null }[]
  children: React.ReactNode
}

function NavLink({ item, locked, onNavigate }: { item: NavItem; locked: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const active = item.href === '/app' ? pathname === '/app' : pathname === item.href || pathname.startsWith(`${item.href}/`)
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn('group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors', active ? 'bg-hover text-fg' : 'text-fg-muted hover:bg-hover/60 hover:text-fg')}
    >
      <item.icon className={cn('size-4 shrink-0', active ? 'text-fg' : 'text-fg-subtle group-hover:text-fg-muted')} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {locked ? <Lock className="size-3 text-fg-subtle" aria-label="Not included in your plan" /> : null}
    </Link>
  )
}

function OrgSwitcher({ org, memberships }: Pick<ShellProps, 'org' | 'memberships'>) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-md border border-border bg-elevated px-2 py-1.5 text-left hover:border-border-strong" disabled={pending}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded text-2xs font-semibold text-white" style={{ background: org.brandColor }}>
            {org.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-fg">{org.name}</span>
            <span className="block text-2xs capitalize text-fg-subtle">{org.role}</span>
          </span>
          <ChevronsUpDown className="size-3.5 text-fg-subtle" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.orgId}
            onSelect={() =>
              m.orgId !== org.id &&
              start(async () => {
                const res = await switchOrganization(m.orgId)
                if (!res.ok) toast.error(res.error.message)
                else router.refresh()
              })
            }
          >
            <span className="flex-1 truncate">{m.name}</span>
            {m.orgId === org.id ? <Check className="text-accent" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/setup">
            <Plus /> New organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Sidebar({ props, onNavigate }: { props: ShellProps; onNavigate?: () => void }) {
  const locked = (m?: Module) => Boolean(m && !props.modules.includes(m))
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo href="/app" />
      </div>
      <div className="px-3">
        <OrgSwitcher org={props.org} memberships={props.memberships} />
      </div>
      <nav className="mt-4 flex-1 space-y-6 overflow-y-auto px-3 pb-4 scrollbar-thin" aria-label="Application">
        <div className="space-y-0.5">
          {NAV_MAIN.map((i) => (
            <NavLink key={i.href} item={i} locked={locked(i.module)} onNavigate={onNavigate} />
          ))}
        </div>
        <div>
          <p className="mb-1.5 px-2 text-2xs font-medium uppercase tracking-wider text-fg-subtle">Organization</p>
          <div className="space-y-0.5">
            {NAV_ORG.map((i) => (
              <NavLink key={i.href} item={i} locked={false} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
        {props.isPlatformAdmin ? (
          <div>
            <p className="mb-1.5 px-2 text-2xs font-medium uppercase tracking-wider text-fg-subtle">Platform</p>
            {NAV_ADMIN.map((i) => (
              <NavLink key={i.href} item={i} locked={false} onNavigate={onNavigate} />
            ))}
          </div>
        ) : null}
      </nav>
      <div className="border-t border-border p-3">
        <Link href="/app/settings/license" onClick={onNavigate} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-fg-muted hover:bg-hover">
          <span>Plan</span>
          <span className="rounded-sm border border-border-strong px-1.5 py-0.5 text-2xs text-fg">{props.planName}</span>
        </Link>
      </div>
    </div>
  )
}

function Notifications({ items }: { items: ShellProps['notifications'] }) {
  const KEY = 'agencyos:notifications-seen'
  const stored = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return Number(localStorage.getItem(KEY) ?? 0)
      } catch {
        return 0
      }
    },
    () => Number.MAX_SAFE_INTEGER,
  )
  const [openedAt, setOpenedAt] = useState(0)
  const seen = Math.max(stored, openedAt)
  const unread = items.filter((n) => new Date(n.created_at).getTime() > seen).length
  return (
    <Popover
      onOpenChange={(o) => {
        if (o) {
          const now = Date.now()
          setOpenedAt(now)
          try {
            localStorage.setItem(KEY, String(now))
          } catch {
            /* ignore */
          }
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="relative">
          <Bell />
          {unread ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[13px] font-medium">Team activity</p>
          <p className="text-2xs text-fg-subtle">Recent changes by others in this organization</p>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-fg-muted">No activity from teammates yet.</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className="border-b border-border px-4 py-2.5 last:border-0">
                <p className="text-[13px] text-fg">
                  <span className="font-medium">{n.actorName ?? 'Someone'}</span> <span className="text-fg-muted">— {n.summary}</span>
                </p>
                <p className="mt-0.5 text-2xs text-fg-subtle">{formatRelative(n.created_at)}</p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function AppShell(props: ShellProps) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface lg:block">
        <Sidebar props={props} />
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface">
            <button className="absolute right-3 top-4 rounded p-1 text-fg-subtle hover:text-fg" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <X className="size-4" />
            </button>
            <Sidebar props={props} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu />
          </Button>
          <button
            onClick={() => setCmdOpen(true)}
            className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[13px] text-fg-subtle hover:border-border-strong"
          >
            <Search className="size-3.5" aria-hidden />
            <span className="flex-1 text-left">Search or jump to…</span>
            <span className="hidden sm:inline">
              <Kbd>⌘K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Notifications items={props.notifications} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 rounded-full" aria-label="Account menu">
                  <Avatar name={props.user.name} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <div className="px-2 py-1.5">
                  <p className="truncate text-[13px] font-medium text-fg">{props.user.name}</p>
                  <p className="truncate text-2xs text-fg-subtle">{props.user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/app/settings">
                    <UserRound /> Profile & settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    await authClient.signOut()
                    router.replace('/login')
                    router.refresh()
                  }}
                >
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1">{props.children}</main>
      </div>
      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} isPlatformAdmin={props.isPlatformAdmin} />
    </div>
  )
}
