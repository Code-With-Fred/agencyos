'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/states'
import { acceptInvitationAction } from '@/actions/team'

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        className="w-full"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await acceptInvitationAction(token)
            if (!res.ok) return setError(res.error.message)
            router.replace('/app')
            router.refresh()
          })
        }
      >
        Accept invitation
      </Button>
    </div>
  )
}
