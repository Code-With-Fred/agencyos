'use client'
import * as React from 'react'
import { DropdownMenu as DM, Popover as P, Tooltip as T, Tabs as TB, Switch as SW, Checkbox as CB } from 'radix-ui'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger
export const DropdownMenuGroup = DM.Group

export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={sideOffset}
        className={cn('z-50 min-w-48 overflow-hidden rounded-lg bg-overlay p-1 shadow-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]', className)}
        {...props}
      />
    </DM.Portal>
  )
}
export function DropdownMenuItem({ className, destructive, ...props }: React.ComponentProps<typeof DM.Item> & { destructive?: boolean }) {
  return (
    <DM.Item
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-fg-muted outline-none data-[highlighted]:bg-hover data-[highlighted]:text-fg data-[disabled]:opacity-50 [&_svg]:size-4',
        destructive && 'text-[#f87171] data-[highlighted]:text-[#fca5a5]',
        className,
      )}
      {...props}
    />
  )
}
export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn('px-2 py-1.5 text-2xs font-medium uppercase tracking-wider text-fg-subtle', className)} {...props} />
}
export function DropdownMenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-border" />
}

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export function PopoverContent({ className, align = 'end', sideOffset = 8, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} className={cn('z-50 rounded-lg bg-overlay shadow-popover outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0', className)} {...props} />
    </P.Portal>
  )
}

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={6} className="z-50 max-w-64 rounded-md border border-border-strong bg-overlay px-2 py-1 text-xs text-fg shadow-popover">
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  )
}

export const Tabs = TB.Root
export function TabsList({ className, ...props }: React.ComponentProps<typeof TB.List>) {
  return <TB.List className={cn('flex gap-1 overflow-x-auto border-b border-border scrollbar-thin', className)} {...props} />
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TB.Trigger>) {
  return (
    <TB.Trigger
      className={cn(
        '-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg',
        className,
      )}
      {...props}
    />
  )
}
export function TabsContent({ className, ...props }: React.ComponentProps<typeof TB.Content>) {
  return <TB.Content className={cn('pt-5 outline-none', className)} {...props} />
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SW.Root>) {
  return (
    <SW.Root className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border-strong bg-elevated transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50', className)} {...props}>
      <SW.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-[18px]" />
    </SW.Root>
  )
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CB.Root>) {
  return (
    <CB.Root className={cn('flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface data-[state=checked]:border-accent data-[state=checked]:bg-accent', className)} {...props}>
      <CB.Indicator>
        <Check className="size-3 text-white" strokeWidth={3} />
      </CB.Indicator>
    </CB.Root>
  )
}
