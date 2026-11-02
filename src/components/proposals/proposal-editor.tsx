'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Download, Eye, Plus, Save, Sparkles, Trash2, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toaster'
import { deleteProposalAction, duplicateProposalAction, regenerateSectionAction, saveSectionAction, updatePricingAction, updateProposalMetaAction } from '@/actions/proposals'
import { formatMoney } from '@/lib/utils'

type Section = { key: string; title: string; content: string; ai_generated: boolean }
type Pricing = { item: string; description: string; amount: number | null }

function SectionEditor({ proposalId, section, canEdit, aiReady }: { proposalId: string; section: Section; canEdit: boolean; aiReady: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState(section.content)
  const [saved, setSaved] = useState(section.content)
  const [saving, startSave] = useTransition()
  const [regen, startRegen] = useTransition()
  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState('')
  const dirty = value !== saved
  return (
    <Card id={section.key}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{section.title}</CardTitle>
          {section.ai_generated && !dirty ? <Badge tone="accent">AI draft</Badge> : null}
          {dirty ? <Badge tone="warning">Unsaved</Badge> : null}
        </div>
        {canEdit && aiReady ? (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)} loading={regen}>
            {!regen ? <Wand2 /> : null} Regenerate
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={Math.min(24, Math.max(6, value.split('\n').length + 2))}
          readOnly={!canEdit}
          aria-label={`${section.title} content`}
          placeholder={canEdit ? 'Write this section. Use "- " for bullet points and "## " for sub-headings.' : ''}
          className="font-normal"
          maxLength={30000}
        />
      </CardContent>
      {canEdit && dirty ? (
        <CardFooter>
          <Button variant="ghost" size="sm" onClick={() => setValue(saved)}>
            Discard
          </Button>
          <Button
            size="sm"
            loading={saving}
            onClick={() =>
              startSave(async () => {
                const res = await saveSectionAction(proposalId, section.key, value)
                if (!res.ok) return void toast.error(res.error.message)
                setSaved(value)
                toast.success(`${section.title} saved`)
                router.refresh()
              })
            }
          >
            <Save /> Save section
          </Button>
        </CardFooter>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title={`Regenerate “${section.title}”`} description="The AI rewrites only this section, keeping it consistent with the rest of the proposal. Your current text will be replaced." />
          <DialogBody>
            <Field label="Instructions (optional)" htmlFor={`ins-${section.key}`} hint="For example: “shorter”, “more detail on reporting”, “mention a 3-phase rollout”.">
              <Textarea id={`ins-${section.key}`} value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} maxLength={1000} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={regen}
              onClick={() =>
                startRegen(async () => {
                  const res = await regenerateSectionAction(proposalId, section.key, instructions)
                  if (!res.ok) return void toast.error(res.error.message)
                  setValue(res.data.content)
                  setSaved(res.data.content)
                  setOpen(false)
                  setInstructions('')
                  toast.success(`${section.title} regenerated`)
                  router.refresh()
                })
              }
            >
              <Sparkles /> Regenerate section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function PricingEditor({ proposalId, items: initial, currency, canEdit }: { proposalId: string; items: Pricing[]; currency: string; canEdit: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<Pricing[]>(initial)
  const [pending, start] = useTransition()
  const total = items.every((i) => i.amount !== null) ? items.reduce((s, i) => s + (i.amount ?? 0), 0) : null
  const set = (idx: number, patch: Partial<Pricing>) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Pricing breakdown</CardTitle>
          <CardDescription>Shown as a table in the Investment section. Leave an amount empty to mark it “to be confirmed”.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_140px_auto]">
            <Input aria-label="Item" value={it.item} onChange={(e) => set(i, { item: e.target.value })} readOnly={!canEdit} maxLength={160} />
            <Input aria-label="Description" value={it.description} onChange={(e) => set(i, { description: e.target.value })} readOnly={!canEdit} maxLength={400} />
            <Input aria-label="Amount" type="number" min={0} step="0.01" value={it.amount ?? ''} onChange={(e) => set(i, { amount: e.target.value === '' ? null : Number(e.target.value) })} readOnly={!canEdit} />
            {canEdit ? (
              <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            ) : null}
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          {canEdit ? (
            <Button variant="ghost" size="sm" onClick={() => setItems((a) => [...a, { item: '', description: '', amount: null }])}>
              <Plus /> Add line
            </Button>
          ) : (
            <span />
          )}
          <p className="text-[13px] text-fg-muted">
            Total: <span className="font-semibold text-fg">{total === null ? 'To be confirmed' : formatMoney(total, currency)}</span>
          </p>
        </div>
      </CardContent>
      {canEdit ? (
        <CardFooter>
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await updatePricingAction(proposalId, items)
                if (!res.ok) return void toast.error(res.error.fieldErrors ? 'Every line needs an item name.' : res.error.message)
                toast.success('Pricing saved')
                router.refresh()
              })
            }
          >
            <Save /> Save pricing
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export function ProposalEditor({
  proposal,
  sections,
  clients,
  canEdit,
  aiReady,
}: {
  proposal: { id: string; title: string; status: string; template: string; client_id: string | null; valid_until: string | null; currency: string; pricing_items: Pricing[] }
  sections: Section[]
  clients: { id: string; name: string }[]
  canEdit: boolean
  aiReady: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [dup, startDup] = useTransition()
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {sections.map((s) =>
          s.key === 'pricing' ? (
            <div key={s.key} className="space-y-4">
              <SectionEditor proposalId={proposal.id} section={s} canEdit={canEdit} aiReady={aiReady} />
              <PricingEditor proposalId={proposal.id} items={proposal.pricing_items} currency={proposal.currency} canEdit={canEdit} />
            </div>
          ) : (
            <SectionEditor key={s.key} proposalId={proposal.id} section={s} canEdit={canEdit} aiReady={aiReady} />
          ),
        )}
      </div>
      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardContent className="grid gap-2 py-4">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/app/proposals/${proposal.id}/preview`}>
                <Eye /> Preview
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <a href={`/api/pdf/proposal/${proposal.id}`} download>
                <Download /> Export PDF
              </a>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={dup}
              onClick={() =>
                startDup(async () => {
                  const res = await duplicateProposalAction(proposal.id)
                  if (!res.ok) return void toast.error(res.error.message)
                  toast.success('Proposal duplicated')
                  router.push(`/app/proposals/${res.data.id}`)
                })
              }
            >
              <Copy /> Duplicate
            </Button>
          </CardContent>
        </Card>
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              start(async () => {
                const res = await updateProposalMetaAction(proposal.id, fd)
                if (!res.ok) return void toast.error(res.error.message)
                toast.success('Proposal details saved')
                router.refresh()
              })
            }}
          >
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset disabled={!canEdit} className="space-y-3">
                <Field label="Title" htmlFor="title">
                  <Input id="title" name="title" defaultValue={proposal.title} required maxLength={200} />
                </Field>
                <Field label="Status" htmlFor="status">
                  <NativeSelect id="status" name="status" defaultValue={proposal.status}>
                    {['draft', 'sent', 'accepted', 'declined', 'archived'].map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Assigned client" htmlFor="clientId">
                  <NativeSelect id="clientId" name="clientId" defaultValue={proposal.client_id ?? ''}>
                    <option value="">Not linked</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Template" htmlFor="template">
                  <NativeSelect id="template" name="template" defaultValue={proposal.template}>
                    <option value="consulting">Consulting</option>
                    <option value="modern">Modern</option>
                    <option value="minimal">Minimal</option>
                  </NativeSelect>
                </Field>
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <Field label="Valid until" htmlFor="validUntil">
                    <Input id="validUntil" name="validUntil" type="date" defaultValue={proposal.valid_until ?? ''} />
                  </Field>
                  <Field label="Currency" htmlFor="currency">
                    <Input id="currency" name="currency" defaultValue={proposal.currency} maxLength={3} className="uppercase" />
                  </Field>
                </div>
              </fieldset>
            </CardContent>
            {canEdit ? (
              <CardFooter className="justify-between">
                <ConfirmDialog
                  title="Delete this proposal?"
                  description="The proposal and all its sections will be permanently deleted."
                  confirmLabel="Delete"
                  trigger={
                    <Button type="button" variant="ghost" size="sm">
                      <Trash2 /> Delete
                    </Button>
                  }
                  onConfirm={async () => {
                    const res = await deleteProposalAction(proposal.id)
                    if (!res.ok) return void toast.error(res.error.message)
                    toast.success('Proposal deleted')
                    router.push('/app/proposals')
                  }}
                />
                <Button type="submit" size="sm" loading={pending}>
                  Save
                </Button>
              </CardFooter>
            ) : null}
          </form>
        </Card>
      </div>
    </div>
  )
}
