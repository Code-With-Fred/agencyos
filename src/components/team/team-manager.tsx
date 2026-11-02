'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Link2, MailPlus, Trash2, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, NativeSelect } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/menu'
import { Avatar } from '@/components/ui/page'
import { Notice } from '@/components/ui/states'
import { toast } from '@/components/ui/toaster'
import { changeRoleAction, inviteMemberAction, removeMemberAction, revokeInvitationAction } from '@/actions/team'
import { formatDate, formatRelative } from '@/lib/utils'

type Member = { id: string; userId: string; name: string; email: string; role: string; joinedAt: string }
type Invite = { id: string; email: string; role: string; expires_at: string; created_at: string }

export function InviteDialog({ actorRole, emailReady }: { actorRole: string; emailReady: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [link, setLink] = useState<{ url: string; emailed: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setLink(null)
          setError(null)
        }
      }}
    >
      <Button size="sm" onClick={() => setOpen(true)}>
        <MailPlus /> Invite member
      </Button>
      <DialogContent>
        <DialogHeader title="Invite a team member" description="Invitation links are single-use and expire after 7 days." />
        {link ? (
          <>
            <DialogBody>
              <Notice tone="success">{link.emailed ? 'Invitation email sent. You can also share the link below.' : 'Invitation created. Share this link with the invitee — it is shown only once.'}</Notice>
              <div className="flex gap-2">
                <Input readOnly value={link.url} aria-label="Invitation link" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link.url)
                    toast.success('Link copied')
                  }}
                >
                  <Copy /> Copy
                </Button>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              start(async () => {
                const res = await inviteMemberAction(fd)
                if (!res.ok) return setError(res.error.fieldErrors?.email?.[0] ?? res.error.message)
                setLink({ url: res.data.link, emailed: res.data.emailed })
                router.refresh()
              })
            }}
          >
            <DialogBody>
              {error ? <Notice tone="danger">{error}</Notice> : null}
              <Field label="Email address" htmlFor="invite-email" required>
                <Input id="invite-email" name="email" type="email" required />
              </Field>
              <Field label="Role" htmlFor="invite-role" hint={actorRole === 'owner' ? 'Admins can manage clients, projects, reports and invite members.' : 'Only owners can invite administrators.'}>
                <NativeSelect id="invite-role" name="role" defaultValue="member">
                  <option value="member">Member</option>
                  {actorRole === 'owner' ? <option value="admin">Admin</option> : null}
                </NativeSelect>
              </Field>
              <label className="flex items-center gap-2 text-[13px] text-fg-muted">
                <Checkbox name="sendEmail" disabled={!emailReady} defaultChecked={emailReady} />
                Send the invitation by email
                {!emailReady ? <span className="text-2xs text-fg-subtle">(email provider not configured)</span> : null}
              </label>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                <Link2 /> Create invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function MembersTable({ members, actorRole, actorUserId }: { members: Member[]; actorRole: string; actorUserId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Members</CardTitle>
          <CardDescription>{members.length} people in this organization</CardDescription>
        </div>
      </CardHeader>
      <ul className="divide-y divide-border">
        {members.map((m) => {
          const isSelf = m.userId === actorUserId
          const canRemove = isSelf || actorRole === 'owner' || (actorRole === 'admin' && m.role === 'member')
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Avatar name={m.name} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">
                  {m.name} {isSelf ? <span className="text-fg-subtle">(you)</span> : null}
                </p>
                <p className="truncate text-xs text-fg-subtle">
                  {m.email} · joined {formatDate(m.joinedAt)}
                </p>
              </div>
              {actorRole === 'owner' ? (
                <NativeSelect
                  aria-label={`Role for ${m.name}`}
                  className="h-8 w-28 text-xs"
                  value={m.role}
                  disabled={pending}
                  onChange={(e) =>
                    start(async () => {
                      const res = await changeRoleAction(m.id, e.target.value)
                      if (!res.ok) toast.error(res.error.message)
                      else toast.success('Role updated')
                      router.refresh()
                    })
                  }
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </NativeSelect>
              ) : (
                <span className="w-20 text-xs capitalize text-fg-muted">{m.role}</span>
              )}
              {canRemove ? (
                <ConfirmDialog
                  title={isSelf ? 'Leave organization?' : `Remove ${m.name}?`}
                  description={isSelf ? 'You will lose access to this organization immediately.' : `${m.name} will immediately lose access to this organization and its projects.`}
                  confirmLabel={isSelf ? 'Leave' : 'Remove'}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={isSelf ? 'Leave organization' : `Remove ${m.name}`}>
                      <UserMinus />
                    </Button>
                  }
                  onConfirm={async () => {
                    const res = await removeMemberAction(m.id)
                    if (!res.ok) return void toast.error(res.error.message)
                    toast.success(isSelf ? 'You left the organization' : 'Member removed')
                    if (isSelf) router.replace('/app')
                    router.refresh()
                  }}
                />
              ) : (
                <span className="size-8" />
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

export function InvitationsTable({ invites }: { invites: Invite[] }) {
  const router = useRouter()
  if (!invites.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
      </CardHeader>
      <ul className="divide-y divide-border">
        {invites.map((i) => {
          const expired = new Date(i.expires_at) < new Date()
          return (
            <li key={i.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-fg">{i.email}</p>
                <p className="text-xs text-fg-subtle">
                  <span className="capitalize">{i.role}</span> · {expired ? <span className="text-warning">expired</span> : `expires ${formatRelative(i.expires_at).replace('in ', 'in ')}`}
                </p>
              </div>
              <ConfirmDialog
                title="Revoke invitation?"
                description={`The invitation link for ${i.email} will stop working immediately.`}
                confirmLabel="Revoke"
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Revoke invitation for ${i.email}`}>
                    <Trash2 />
                  </Button>
                }
                onConfirm={async () => {
                  const res = await revokeInvitationAction(i.id)
                  if (!res.ok) return void toast.error(res.error.message)
                  toast.success('Invitation revoked')
                  router.refresh()
                }}
              />
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
