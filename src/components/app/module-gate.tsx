import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { MODULE_LABELS, type Module } from '@/lib/licensing/plans'
import type { Entitlements } from '@/lib/licensing/entitlements'

/** Server-rendered plan gate. Actions enforce the same check server-side. */
export function ModuleGate({ ent, module, children }: { ent: Entitlements; module: Module; children: React.ReactNode }) {
  if (ent.modules.includes(module)) return <>{children}</>
  return (
    <EmptyState
      icon={Lock}
      title={`${MODULE_LABELS[module]} is not included in the ${ent.name} plan`}
      description="Upgrade to the Agency plan to unlock reporting and onboarding automation."
      action={
        <Button asChild>
          <Link href="/app/settings/license">View license options</Link>
        </Button>
      }
    />
  )
}
