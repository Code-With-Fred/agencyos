'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, KeyRound, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu'
import { Notice } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toaster'
import { adminActivationsAction, adminCreateLicenseAction, adminRevealKeyAction, adminSetStatusAction } from '@/actions/licensing'
import { formatDate, formatMoney } from '@/lib/utils'
import { CopyField } from './copy-field'

type License = { id: string; plan: string; status: string; source: string; key_last4: string; customer_email: string; customer_name: string | null; max_activations: number; expires_at: string | null; amount_total: number | null; currency: string | null; created_at: string; revoked_reason: string | null; notes: string | null; activeActivations: number }

export function CreateLicenseDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setKey(null)
          setError(null)
        }
      }}
    >
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Issue license
      </Button>
      <DialogContent>
        <DialogHeader title="Issue a manual license" description="For bank transfers, offline sales and Enterprise agreements. Only issue after payment is confirmed or authorized." />
        {key ? (
          <>
            <DialogBody>
              <Notice tone="success">License issued. Send this key to the customer securely.</Notice>
              <CopyField value={key} label="License key" />
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
                const res = await adminCreateLicenseAction(fd)
                if (!res.ok) return setError(res.error.message)
                setKey(res.data.key)
                router.refresh()
              })
            }}
          >
            <DialogBody>
              {error ? <Notice tone="danger">{error}</Notice> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Plan" htmlFor="lic-plan">
                  <NativeSelect id="lic-plan" name="plan" defaultValue="agency">
                    <option value="standard">Standard</option>
                    <option value="agency">Agency</option>
                    <option value="enterprise">Enterprise</option>
                  </NativeSelect>
                </Field>
                <Field label="Max activations" htmlFor="lic-max" hint="Organizations that can use this key at once.">
                  <Input id="lic-max" name="maxActivations" type="number" min={1} max={100} defaultValue={1} />
                </Field>
                <Field label="Customer email" htmlFor="lic-email" required>
                  <Input id="lic-email" name="customerEmail" type="email" required />
                </Field>
                <Field label="Customer name" htmlFor="lic-name">
                  <Input id="lic-name" name="customerName" maxLength={200} />
                </Field>
                <Field label="Expires" htmlFor="lic-exp" hint="Leave empty for a perpetual license.">
                  <Input id="lic-exp" name="expiresAt" type="date" />
                </Field>
              </div>
              <Field label="Internal notes" htmlFor="lic-notes" hint="E.g. invoice number or payment reference.">
                <Textarea id="lic-notes" name="notes" rows={2} maxLength={2000} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                <KeyRound /> Issue license
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function LicenseTable({ licenses }: { licenses: License[] }) {
  const router = useRouter()
  const [detail, setDetail] = useState<{ title: string; body: React.ReactNode } | null>(null)
  const [statusTarget, setStatusTarget] = useState<{ id: string; status: 'suspended' | 'revoked' | 'active' } | null>(null)
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()
  return (
    <Card>
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Customer</TH>
            <TH>Plan</TH>
            <TH>Key</TH>
            <TH>Status</TH>
            <TH>Activations</TH>
            <TH className="hidden md:table-cell">Source</TH>
            <TH className="hidden lg:table-cell">Expires</TH>
            <TH className="hidden lg:table-cell">Issued</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {licenses.length === 0 ? (
            <TR>
              <TD colSpan={9} className="py-10 text-center">
                No licenses yet.
              </TD>
            </TR>
          ) : null}
          {licenses.map((l) => (
            <TR key={l.id}>
              <TD>
                <p className="text-fg">{l.customer_name ?? l.customer_email}</p>
                {l.customer_name ? <p className="text-xs text-fg-subtle">{l.customer_email}</p> : null}
              </TD>
              <TD className="capitalize">{l.plan}</TD>
              <TD className="font-mono text-xs">…{l.key_last4}</TD>
              <TD>
                <Badge tone={l.status === 'active' ? 'success' : l.status === 'suspended' ? 'warning' : 'danger'}>{l.status}</Badge>
                {l.revoked_reason ? <p className="mt-0.5 text-2xs text-fg-subtle">{l.revoked_reason}</p> : null}
              </TD>
              <TD className="tabular-nums">
                {Number(l.activeActivations)} / {l.max_activations}
              </TD>
              <TD className="hidden capitalize md:table-cell">
                {l.source}
                {l.amount_total !== null ? <p className="text-2xs text-fg-subtle">{formatMoney(l.amount_total / 100, (l.currency ?? 'usd').toUpperCase())}</p> : null}
              </TD>
              <TD className="hidden lg:table-cell">{l.expires_at ? formatDate(l.expires_at) : 'Perpetual'}</TD>
              <TD className="hidden lg:table-cell">{formatDate(l.created_at)}</TD>
              <TD>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Manage
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={async () => {
                        const res = await adminRevealKeyAction(l.id)
                        if (!res.ok) return void toast.error(res.error.message)
                        setDetail({ title: 'License key', body: <CopyField value={res.data.key} label="License key" /> })
                      }}
                    >
                      <Eye /> Reveal key
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={async () => {
                        const res = await adminActivationsAction(l.id)
                        if (!res.ok) return void toast.error(res.error.message)
                        setDetail({
                          title: 'Activations',
                          body: res.data.length ? (
                            <ul className="space-y-2 text-[13px]">
                              {res.data.map((a) => (
                                <li key={a.id} className="flex justify-between gap-3">
                                  <span className="text-fg">{a.orgName}</span>
                                  <span className="text-fg-subtle">
                                    {formatDate(a.activated_at)}
                                    {a.deactivated_at ? ` → ${formatDate(a.deactivated_at)}` : ' · active'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[13px] text-fg-muted">Not activated yet.</p>
                          ),
                        })
                      }}
                    >
                      Activations
                    </DropdownMenuItem>
                    {l.status === 'active' ? <DropdownMenuItem onSelect={() => setStatusTarget({ id: l.id, status: 'suspended' })}>Suspend</DropdownMenuItem> : null}
                    {l.status === 'suspended' ? <DropdownMenuItem onSelect={() => setStatusTarget({ id: l.id, status: 'active' })}>Reactivate</DropdownMenuItem> : null}
                    {l.status !== 'revoked' ? (
                      <DropdownMenuItem destructive onSelect={() => setStatusTarget({ id: l.id, status: 'revoked' })}>
                        Revoke
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader title={detail?.title ?? ''} />
          <DialogBody>{detail?.body}</DialogBody>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(statusTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setStatusTarget(null)
            setReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader
            title={statusTarget?.status === 'revoked' ? 'Revoke license' : statusTarget?.status === 'suspended' ? 'Suspend license' : 'Reactivate license'}
            description={statusTarget?.status === 'revoked' ? 'Revocation is permanent and deactivates the license in every organization using it.' : statusTarget?.status === 'suspended' ? 'Organizations using this key fall back to the Evaluation plan until it is reactivated.' : 'The license becomes valid again for its current activations.'}
          />
          {statusTarget?.status !== 'active' ? (
            <DialogBody>
              <Field label="Reason" htmlFor="status-reason">
                <Input id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </Field>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={statusTarget?.status === 'active' ? 'primary' : 'danger'}
              loading={pending}
              onClick={() =>
                statusTarget &&
                start(async () => {
                  const res = await adminSetStatusAction(statusTarget.id, statusTarget.status, reason)
                  if (!res.ok) return void toast.error(res.error.message)
                  toast.success('License updated')
                  setStatusTarget(null)
                  setReason('')
                  router.refresh()
                })
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
