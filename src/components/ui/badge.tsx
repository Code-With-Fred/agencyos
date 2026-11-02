import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-medium leading-none whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'border-border-strong bg-elevated text-fg-muted',
      accent: 'border-accent/30 bg-accent-soft text-[#a9a7ff]',
      success: 'border-success/25 bg-success-soft text-success',
      warning: 'border-warning/25 bg-warning-soft text-warning',
      danger: 'border-danger/25 bg-danger-soft text-[#f87171]',
      info: 'border-info/25 bg-info-soft text-info',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export function StatusDot({ className, color }: { className?: string; color: string }) {
  return <span aria-hidden className={cn('inline-block size-1.5 rounded-full', className)} style={{ background: color }} />
}
