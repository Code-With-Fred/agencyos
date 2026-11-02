'use client'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { deleteClientAction } from '@/actions/clients'
import { ClientDialog, type ClientValues } from './client-form'

export function ClientActions({ client, canDelete, canEdit }: { client: ClientValues; canDelete: boolean; canEdit: boolean }) {
  const router = useRouter()
  return (
    <>
      {canEdit ? (
        <ClientDialog
          client={client}
          trigger={
            <Button variant="secondary" size="sm">
              <Pencil /> Edit
            </Button>
          }
        />
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          title={`Delete ${client.name}?`}
          description="The client record will be permanently deleted. Projects, audits, proposals and reports are kept but no longer linked to this client."
          confirmLabel="Delete client"
          trigger={
            <Button variant="ghost" size="sm">
              <Trash2 /> Delete
            </Button>
          }
          onConfirm={async () => {
            const res = await deleteClientAction(client.id)
            if (!res.ok) return void toast.error(res.error.message)
            toast.success('Client deleted')
            router.push('/app/clients')
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
