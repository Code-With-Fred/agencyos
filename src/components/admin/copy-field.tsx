'use client'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'

export function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} className="font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
      <Button
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          toast.success('Copied')
        }}
      >
        <Copy /> Copy
      </Button>
    </div>
  )
}
