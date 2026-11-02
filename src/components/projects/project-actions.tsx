'use client'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { deleteProjectAction } from '@/actions/clients'

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  return (
    <ConfirmDialog
      title={`Delete ${name}?`}
      description="The project, its tasks and assignments will be permanently deleted."
      confirmLabel="Delete project"
      trigger={
        <Button variant="ghost" size="sm">
          <Trash2 /> Delete
        </Button>
      }
      onConfirm={async () => {
        const res = await deleteProjectAction(id)
        if (!res.ok) return void toast.error(res.error.message)
        toast.success('Project deleted')
        router.push('/app/projects')
        router.refresh()
      }}
    />
  )
}
