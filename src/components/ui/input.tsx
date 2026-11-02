import * as React from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'flex h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg transition-colors placeholder:text-fg-subtle hover:border-[#3b3b45] focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-50 aria-[invalid=true]:border-danger/70'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-24 py-2 leading-relaxed', className)} {...props} />
}

export function NativeSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        inputClass,
        'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%236b6b76%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-[position:right_0.6rem_center] bg-no-repeat pr-9',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-fg', className)} {...props} />
}

type FieldProps = {
  label: string
  htmlFor: string
  error?: string[] | string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

/** Label + control + hint/error with correct aria wiring by convention (id-error). */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  const msg = Array.isArray(error) ? error[0] : error
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-fg-subtle"> *</span> : null}
      </Label>
      {children}
      {msg ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
          {msg}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  )
}
