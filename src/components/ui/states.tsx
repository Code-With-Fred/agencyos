import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, PlugZap } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-border-strong bg-elevated">
        <Icon className="size-5 text-fg-muted" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-fg-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', description, action }: { title?: string; description: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-lg border border-danger/25 bg-danger-soft px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-5 text-danger" aria-hidden />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-[13px] text-fg-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/** Shown when a feature depends on an external service that is not configured. */
export function SetupRequired({ title, description, envVars, className }: { title: string; description: string; envVars: string[]; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-warning/25 bg-warning-soft/40 p-4', className)}>
      <div className="flex gap-3">
        <PlugZap className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-fg">{title}</p>
          <p className="mt-1 text-[13px] text-fg-muted">{description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {envVars.map((v) => (
              <code key={v} className="rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-2xs text-fg-muted">
                {v}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: React.ReactNode; className?: string }) {
  const tones = {
    info: 'border-info/25 bg-info-soft/50',
    warning: 'border-warning/25 bg-warning-soft/50',
    danger: 'border-danger/25 bg-danger-soft/60',
    success: 'border-success/25 bg-success-soft/50',
  }
  return <div className={cn('rounded-md border px-3 py-2 text-[13px] text-fg-muted', tones[tone], className)}>{children}</div>
}
