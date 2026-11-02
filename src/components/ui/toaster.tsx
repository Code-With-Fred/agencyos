'use client'
import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: '!bg-overlay !border !border-border-strong !text-fg !rounded-lg !shadow-popover',
          description: '!text-fg-muted',
        },
      }}
    />
  )
}
export { toast } from 'sonner'
