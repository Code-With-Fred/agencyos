'use client'
import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/menu'
import { toast } from '@/components/ui/toaster'
import { addTaskAction, deleteTaskAction, setTaskStatusAction } from '@/actions/clients'
import { cn, formatDate } from '@/lib/utils'

type Task = { id: string; title: string; status: string; due_date: string | null; assigneeName: string | null; created_by: string | null }

export function TaskList({ projectId, tasks, members, userId, isAdmin }: { projectId: string; tasks: Task[]; members: { userId: string; name: string }[]; userId: string; isAdmin: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) =>
    start(async () => {
      const res = await fn()
      if (!res.ok) toast.error(res.error?.message ?? 'Action failed')
      router.refresh()
    })

  return (
    <div>
      <ul className="divide-y divide-border">
        {tasks.length === 0 ? <li className="px-5 py-8 text-center text-[13px] text-fg-muted">No tasks yet. Add the first one below.</li> : null}
        {tasks.map((t) => (
          <li key={t.id} className="group flex items-center gap-3 px-5 py-2.5">
            <Checkbox
              checked={t.status === 'done'}
              disabled={pending}
              aria-label={`Mark "${t.title}" as ${t.status === 'done' ? 'not done' : 'done'}`}
              onCheckedChange={(c) => run(() => setTaskStatusAction(projectId, t.id, c ? 'done' : 'todo'))}
            />
            <span className={cn('min-w-0 flex-1 truncate text-[13px]', t.status === 'done' ? 'text-fg-subtle line-through' : 'text-fg')}>{t.title}</span>
            {t.status !== 'done' ? (
              <NativeSelect
                aria-label="Task status"
                className="h-7 w-32 text-xs"
                value={t.status}
                disabled={pending}
                onChange={(e) => run(() => setTaskStatusAction(projectId, t.id, e.target.value))}
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </NativeSelect>
            ) : null}
            <span className="hidden w-28 truncate text-xs text-fg-subtle sm:block">{t.assigneeName ?? 'Unassigned'}</span>
            <span className="hidden w-24 text-xs text-fg-subtle md:block">{t.due_date ? formatDate(t.due_date) : ''}</span>
            {isAdmin || t.created_by === userId ? (
              <Button variant="ghost" size="icon-sm" aria-label={`Delete task ${t.title}`} className="opacity-60 group-hover:opacity-100" onClick={() => run(() => deleteTaskAction(projectId, t.id))}>
                <Trash2 />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        ref={formRef}
        className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          run(async () => {
            const res = await addTaskAction(projectId, fd)
            if (res.ok) formRef.current?.reset()
            return res
          })
        }}
      >
        <Input name="title" placeholder="Add a task…" required maxLength={300} aria-label="Task title" className="flex-1" />
        <NativeSelect name="assigneeId" aria-label="Assignee" className="sm:w-40">
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
        <Input name="dueDate" type="date" aria-label="Due date" className="sm:w-40" />
        <Button type="submit" variant="secondary" loading={pending}>
          <Plus /> Add
        </Button>
      </form>
    </div>
  )
}
