'use client'
import * as React from 'react'
import { Dialog as D, AlertDialog as AD } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export const Dialog = D.Root
export const DialogTrigger = D.Trigger
export const DialogClose = D.Close

const overlay = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
const panel =
  'fixed left-1/2 top-1/2 z-50 grid max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border-strong bg-elevated shadow-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 scrollbar-thin'

export function DialogContent({ className, children, size = 'md', ...props }: React.ComponentProps<typeof D.Content> & { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content className={cn(panel, width, className)} {...props}>
        {children}
        <D.Close className="absolute right-3 top-3 rounded-md p-1.5 text-fg-subtle hover:bg-hover hover:text-fg" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  )
}
export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-border px-6 py-4 pr-12">
      <D.Title className="text-[15px] font-semibold text-fg">{title}</D.Title>
      {description ? <D.Description className="mt-1 text-[13px] text-fg-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
    </div>
  )
}
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-4 px-6 py-5', className)} {...props} />
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse gap-2 border-t border-border px-6 py-3 sm:flex-row sm:justify-end', className)} {...props} />
}

type ConfirmProps = {
  trigger: React.ReactNode
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => Promise<void> | void
}

/** Confirmation for destructive actions. Stays open with a spinner until done. */
export function ConfirmDialog({ trigger, title, description, confirmLabel = 'Confirm', destructive = true, onConfirm }: ConfirmProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  return (
    <AD.Root open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AD.Trigger asChild>{trigger}</AD.Trigger>
      <AD.Portal>
        <AD.Overlay className={overlay} />
        <AD.Content className={cn(panel, 'max-w-md')}>
          <div className="px-6 pt-5">
            <AD.Title className="text-[15px] font-semibold">{title}</AD.Title>
            <AD.Description className="mt-2 text-[13px] leading-relaxed text-fg-muted">{description}</AD.Description>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-border px-6 py-3">
            <AD.Cancel asChild>
              <Button variant="ghost" size="sm" disabled={pending}>
                Cancel
              </Button>
            </AD.Cancel>
            <Button
              size="sm"
              variant={destructive ? 'danger' : 'primary'}
              loading={pending}
              onClick={async () => {
                setPending(true)
                try {
                  await onConfirm()
                  setOpen(false)
                } finally {
                  setPending(false)
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  )
}
