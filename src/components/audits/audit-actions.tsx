'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, RefreshCcw, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { deleteAuditAction, regenerateAuditAction } from '@/actions/audits'

export function AuditActions({ id, url, clientId, completed, canDelete, aiReady }: { id: string; url: string; clientId: string | null; completed: boolean; canDelete: boolean; aiReady: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <>
      {completed ? (
        <Button asChild variant="secondary" size="sm">
          <a href={`/api/pdf/audit/${id}`} download>
            <Download /> Export PDF
          </a>
        </Button>
      ) : null}
      {completed && aiReady ? (
        <Button
          variant="secondary"
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await regenerateAuditAction(id)
              if (!res.ok) toast.error(res.error.message)
              else toast.success('AI analysis regenerated')
              router.refresh()
            })
          }
        >
          {!pending ? <Sparkles /> : null} Regenerate analysis
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" onClick={() => router.push(`/app/audits?new=1${clientId ? `&client=${clientId}` : ''}&url=${encodeURIComponent(url)}`)}>
        <RefreshCcw /> Re-run
      </Button>
      {canDelete ? (
        <ConfirmDialog
          title="Delete this audit?"
          description="The audit and its analysis will be permanently deleted. Reports that reference it will no longer include audit results."
          confirmLabel="Delete audit"
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Delete audit">
              <Trash2 />
            </Button>
          }
          onConfirm={async () => {
            const res = await deleteAuditAction(id)
            if (!res.ok) return void toast.error(res.error.message)
            toast.success('Audit deleted')
            router.push('/app/audits')
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
