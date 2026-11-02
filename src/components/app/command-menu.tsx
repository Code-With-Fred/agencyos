'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Dialog as D } from 'radix-ui'
import { Building2, FileSignature, FolderKanban, LineChart, Search } from 'lucide-react'
import { searchAction } from '@/actions/clients'
import { NAV_ADMIN, NAV_MAIN, NAV_ORG, QUICK_ACTIONS } from './nav'

type Result = { id: string; label: string; type: 'client' | 'project' | 'proposal' | 'report'; href: string }
const TYPE_ICON = { client: Building2, project: FolderKanban, proposal: FileSignature, report: LineChart }

export function CommandMenu({ open, onOpenChange, isPlatformAdmin }: { open: boolean; onOpenChange: (o: boolean) => void; isPlatformAdmin: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])

  useEffect(() => {
    if (q.trim().length < 2) return
    const t = setTimeout(async () => {
      const res = await searchAction(q)
      if (res.ok) setResults(res.data)
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  const visible = q.trim().length >= 2 ? results : []
  const go = (href: string) => {
    onOpenChange(false)
    setQ('')
    router.push(href)
  }
  const pages = [...NAV_MAIN, ...NAV_ORG, ...(isPlatformAdmin ? NAV_ADMIN : [])]
  const item = 'flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-fg-muted data-[selected=true]:bg-hover data-[selected=true]:text-fg [&_svg]:size-4'
  const group = '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle'

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <D.Content className="fixed left-1/2 top-[15vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border-strong bg-elevated shadow-popover">
          <D.Title className="sr-only">Command menu</D.Title>
          <D.Description className="sr-only">Search the workspace or jump to a page</D.Description>
          <Command shouldFilter={true} loop>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-fg-subtle" aria-hidden />
              <Command.Input value={q} onValueChange={setQ} placeholder="Search clients, projects, proposals, reports…" className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle" />
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-2 scrollbar-thin">
              <Command.Empty className="px-3 py-8 text-center text-[13px] text-fg-muted">No results.</Command.Empty>
              {visible.length ? (
                <Command.Group heading="Workspace" className={group}>
                  {visible.map((r) => {
                    const I = TYPE_ICON[r.type]
                    return (
                      <Command.Item key={`${r.type}-${r.id}`} value={`${r.label} ${r.type} ${r.id}`} onSelect={() => go(r.href)} className={item}>
                        <I /> <span className="flex-1 truncate">{r.label}</span>
                        <span className="text-2xs capitalize text-fg-subtle">{r.type}</span>
                      </Command.Item>
                    )
                  })}
                </Command.Group>
              ) : null}
              <Command.Group heading="Quick actions" className={group}>
                {QUICK_ACTIONS.map((a) => (
                  <Command.Item key={a.href} value={a.label} onSelect={() => go(a.href)} className={item}>
                    <a.icon /> {a.label}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Go to" className={group}>
                {pages.map((p) => (
                  <Command.Item key={p.href} value={`go ${p.label}`} onSelect={() => go(p.href)} className={item}>
                    <p.icon /> {p.label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
