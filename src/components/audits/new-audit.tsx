'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, NativeSelect } from '@/components/ui/input'
import { Notice } from '@/components/ui/states'
import { cn } from '@/lib/utils'

const STEPS: { key: string; label: string; optional?: 'pagespeed' | 'ai' }[] = [
  { key: 'fetching', label: 'Fetching the page securely' },
  { key: 'robots', label: 'Checking robots.txt, sitemap and HTTPS' },
  { key: 'links', label: 'Testing a sample of internal links' },
  { key: 'assets', label: 'Measuring images and assets' },
  { key: 'pagespeed', label: 'Querying PageSpeed Insights', optional: 'pagespeed' },
  { key: 'scoring', label: 'Running rules and scoring' },
  { key: 'saving', label: 'Saving results' },
  { key: 'ai', label: 'Generating AI analysis', optional: 'ai' },
]

export function NewAudit({ clients, defaultClientId, defaultUrl, pagespeed, ai, autoFocus }: { clients: { id: string; name: string; website: string | null }[]; defaultClientId?: string; defaultUrl?: string; pagespeed: boolean; ai: boolean; autoFocus?: boolean }) {
  const router = useRouter()
  const [url, setUrl] = useState(defaultUrl ?? '')
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [running, setRunning] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const steps = STEPS.filter((s) => (s.optional === 'pagespeed' ? pagespeed : s.optional === 'ai' ? ai : true))

  async function start(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone([])
    setCurrent(null)
    setRunning(true)
    try {
      const res = await fetch('/api/audits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, clientId: clientId || null }) })
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null
        throw new Error(body?.error?.message ?? 'The audit could not be started.')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let last: string | null = null
      for (;;) {
        const { value, done: finished } = await reader.read()
        if (finished) break
        buf += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line) continue
          const evt = JSON.parse(line) as { type: string; step?: string; id?: string; error?: { message: string } }
          if (evt.type === 'progress' && evt.step) {
            if (last) setDone((d) => [...d, last!])
            last = evt.step
            setCurrent(evt.step)
          } else if (evt.type === 'done' && evt.id) {
            router.push(`/app/audits/${evt.id}`)
            router.refresh()
            return
          } else if (evt.type === 'error') {
            throw new Error(evt.error?.message ?? 'The audit failed.')
          }
        }
      }
      throw new Error('The connection closed before the audit finished. Check the audit history.')
    } catch (err) {
      setError((err as Error).message)
      setRunning(false)
      router.refresh()
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>New website audit</CardTitle>
          <CardDescription>The page is inspected server-side without running its JavaScript. Results usually take 15–60 seconds.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={start} className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
          <Field label="Website URL" htmlFor="audit-url">
            <Input
              ref={inputRef}
              id="audit-url"
              name="url"
              placeholder="example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              maxLength={2048}
              disabled={running}
              inputMode="url"
              autoComplete="url"
            />
          </Field>
          <Field label="Client (optional)" htmlFor="audit-client">
            <NativeSelect
              id="audit-client"
              value={clientId}
              disabled={running}
              onChange={(e) => {
                setClientId(e.target.value)
                const c = clients.find((x) => x.id === e.target.value)
                if (c?.website && !url) setUrl(c.website)
              }}
            >
              <option value="">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button type="submit" loading={running}>
            {!running ? <ScanSearch /> : null} {running ? 'Auditing…' : 'Run audit'}
          </Button>
        </form>
        {error ? (
          <Notice tone="danger" className="mt-4">
            {error}
          </Notice>
        ) : null}
        {running ? (
          <ol className="mt-5 grid gap-1.5 sm:grid-cols-2" aria-live="polite">
            {steps.map((s) => {
              const isDone = done.includes(s.key)
              const isCurrent = current === s.key
              return (
                <li key={s.key} className={cn('flex items-center gap-2 text-[13px]', isDone ? 'text-fg-muted' : isCurrent ? 'text-fg' : 'text-fg-subtle')}>
                  {isDone ? <Check className="size-3.5 text-success" aria-hidden /> : isCurrent ? <Loader2 className="size-3.5 animate-spin text-accent" aria-hidden /> : <span className="size-3.5 rounded-full border border-border-strong" aria-hidden />}
                  {s.label}
                </li>
              )
            })}
          </ol>
        ) : null}
        {!ai ? <p className="mt-3 text-xs text-fg-subtle">AI analysis is disabled because Gemini is not configured — measured findings and scores are still produced.</p> : null}
      </CardContent>
    </Card>
  )
}
