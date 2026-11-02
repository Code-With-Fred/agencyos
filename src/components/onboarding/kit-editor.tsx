'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { randomId } from '@/lib/client-id'
import { Download, Mail, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Checkbox, Tooltip } from '@/components/ui/menu'
import { Progress } from '@/components/ui/page'
import { toast } from '@/components/ui/toaster'
import { StatusBadge } from '@/components/app/status'
import { deleteOnboardingKitAction, sendWelcomeEmailAction, setChecklistItemsAction, updateOnboardingDocAction } from '@/actions/onboarding'
import { cn, formatDateTime } from '@/lib/utils'

type Item = { id: string; label: string; done: boolean }
type Doc = { id: string; doc_type: string; title: string; subject: string | null; content: string; items: Item[]; status: string; sent_at: string | null }

function Checklist({ kitId, doc, canEdit }: { kitId: string; doc: Doc; canEdit: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>(doc.items)
  const [label, setLabel] = useState('')
  const [pending, start] = useTransition()
  const save = (next: Item[]) => {
    setItems(next)
    start(async () => {
      const res = await setChecklistItemsAction(kitId, doc.id, next)
      if (!res.ok) {
        toast.error(res.error.message)
        setItems(items)
      }
      router.refresh()
    })
  }
  const done = items.filter((i) => i.done).length
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Progress value={items.length ? (done / items.length) * 100 : 0} className="flex-1" />
        <span className="text-xs tabular-nums text-fg-muted">
          {done}/{items.length}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="group flex items-center gap-2.5 rounded px-1 py-1 hover:bg-hover/50">
            <Checkbox checked={it.done} disabled={!canEdit || pending} aria-label={it.label} onCheckedChange={(c) => save(items.map((x) => (x.id === it.id ? { ...x, done: c === true } : x)))} />
            <span className={cn('flex-1 text-[13px]', it.done ? 'text-fg-subtle line-through' : 'text-fg')}>{it.label}</span>
            {canEdit ? (
              <button className="opacity-0 group-hover:opacity-100" aria-label={`Remove ${it.label}`} onClick={() => save(items.filter((x) => x.id !== it.id))}>
                <Trash2 className="size-3.5 text-fg-subtle hover:text-fg" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!label.trim()) return
            save([...items, { id: randomId(), label: label.trim().slice(0, 300), done: false }])
            setLabel('')
          }}
        >
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add item" aria-label="New checklist item" maxLength={300} />
          <Button type="submit" variant="secondary" size="sm" className="h-9">
            <Plus /> Add
          </Button>
        </form>
      ) : null}
    </div>
  )
}

function DocCard({ kitId, doc, canEdit, canSend, emailReady, clientEmail }: { kitId: string; doc: Doc; canEdit: boolean; canSend: boolean; emailReady: boolean; clientEmail: string | null }) {
  const router = useRouter()
  const [title, setTitle] = useState(doc.title)
  const [subject, setSubject] = useState(doc.subject ?? '')
  const [content, setContent] = useState(doc.content)
  const [status, setStatus] = useState(doc.status)
  const [pending, start] = useTransition()
  const dirty = title !== doc.title || subject !== (doc.subject ?? '') || content !== doc.content || status !== doc.status
  const isEmail = doc.doc_type === 'welcome_email'
  const isChecklist = doc.doc_type === 'checklist' || doc.doc_type === 'asset_list'
  const sendBlocked = !emailReady ? 'Email delivery is not configured (RESEND_API_KEY, EMAIL_FROM).' : !clientEmail ? 'The client has no email address.' : !canSend ? 'Only owners and admins can send emails to clients.' : dirty ? 'Save your changes before sending.' : null
  return (
    <Card id={doc.doc_type}>
      <CardHeader>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CardTitle className="truncate">{doc.title}</CardTitle>
          <StatusBadge status={doc.status} />
          {doc.sent_at ? <span className="text-2xs text-fg-subtle">sent {formatDateTime(doc.sent_at)}</span> : null}
        </div>
        {isEmail ? (
          sendBlocked ? (
            <Tooltip content={sendBlocked}>
              <span>
                <Button variant="secondary" size="sm" disabled>
                  <Mail /> Send to client
                </Button>
              </span>
            </Tooltip>
          ) : (
            <ConfirmDialog
              title="Send the welcome email?"
              description={`This sends “${doc.subject}” to ${clientEmail} now, from your configured email provider. This cannot be undone.`}
              confirmLabel="Send email"
              destructive={false}
              trigger={
                <Button variant="secondary" size="sm">
                  <Mail /> Send to client
                </Button>
              }
              onConfirm={async () => {
                const res = await sendWelcomeEmailAction(kitId, doc.id)
                if (!res.ok) return void toast.error(res.error.message)
                toast.success(`Email sent to ${res.data.to}`)
                router.refresh()
              }}
            />
          )
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <fieldset disabled={!canEdit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Title" htmlFor={`t-${doc.id}`}>
              <Input id={`t-${doc.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </Field>
            <Field label="Status" htmlFor={`s-${doc.id}`}>
              <NativeSelect id={`s-${doc.id}`} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                {isEmail ? <option value="sent">Sent</option> : null}
                <option value="completed">Completed</option>
              </NativeSelect>
            </Field>
          </div>
          {isEmail ? (
            <Field label="Subject" htmlFor={`sub-${doc.id}`}>
              <Input id={`sub-${doc.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} />
            </Field>
          ) : null}
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={Math.min(22, Math.max(5, content.split('\n').length + 1))} aria-label={`${doc.title} content`} maxLength={30000} placeholder="Write this document…" />
        </fieldset>
        {isChecklist ? <Checklist kitId={kitId} doc={doc} canEdit={canEdit} /> : null}
      </CardContent>
      {canEdit && dirty ? (
        <CardFooter>
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await updateOnboardingDocAction(kitId, doc.id, { title, subject: isEmail ? subject : null, content, status })
                if (!res.ok) return void toast.error(res.error.message)
                toast.success('Document saved')
                router.refresh()
              })
            }
          >
            <Save /> Save
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export function KitEditor({ kitId, docs, progress, canEdit, canSend, emailReady, clientEmail }: { kitId: string; docs: Doc[]; progress: { done: number; total: number; percent: number }; canEdit: boolean; canSend: boolean; emailReady: boolean; clientEmail: string | null }) {
  const router = useRouter()
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        {docs.map((d) => (
          <DocCard key={`${d.id}-${d.status}-${d.items.length}`} kitId={kitId} doc={d} canEdit={canEdit} canSend={canSend} emailReady={emailReady} clientEmail={clientEmail} />
        ))}
      </div>
      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Onboarding progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">{progress.percent}%</span>
              <span className="text-xs text-fg-subtle">
                {progress.done} of {progress.total} steps
              </span>
            </div>
            <Progress value={progress.percent} />
            <ul className="space-y-1 pt-2">
              {docs.map((d) => (
                <li key={d.id}>
                  <a href={`#${d.doc_type}`} className="flex items-center justify-between rounded px-1.5 py-1 text-[13px] text-fg-muted hover:bg-hover hover:text-fg">
                    <span className="truncate">{d.title}</span>
                    <StatusBadge status={d.status} />
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="justify-between">
            {canEdit ? (
              <ConfirmDialog
                title="Delete these onboarding documents?"
                description="All documents and checklist progress in this kit will be permanently deleted."
                confirmLabel="Delete"
                trigger={
                  <Button variant="ghost" size="sm">
                    <Trash2 /> Delete
                  </Button>
                }
                onConfirm={async () => {
                  const res = await deleteOnboardingKitAction(kitId)
                  if (!res.ok) return void toast.error(res.error.message)
                  toast.success('Deleted')
                  router.push('/app/onboarding')
                }}
              />
            ) : (
              <span />
            )}
            <Button asChild variant="secondary" size="sm">
              <a href={`/api/pdf/onboarding/${kitId}`} download>
                <Download /> Export PDF
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
