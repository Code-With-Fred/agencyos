import { Badge, type BadgeTone } from '@/components/ui/badge'

const MAP: Record<string, [string, BadgeTone]> = {
  lead: ['Lead', 'info'],
  active: ['Active', 'success'],
  paused: ['Paused', 'warning'],
  archived: ['Archived', 'neutral'],
  planning: ['Planning', 'neutral'],
  in_progress: ['In progress', 'accent'],
  review: ['Review', 'info'],
  completed: ['Completed', 'success'],
  on_hold: ['On hold', 'warning'],
  running: ['Running', 'accent'],
  failed: ['Failed', 'danger'],
  draft: ['Draft', 'neutral'],
  sent: ['Sent', 'info'],
  accepted: ['Accepted', 'success'],
  declined: ['Declined', 'danger'],
  final: ['Final', 'success'],
  ready: ['Ready', 'info'],
  todo: ['To do', 'neutral'],
  done: ['Done', 'success'],
}

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = MAP[status] ?? [status, 'neutral' as BadgeTone]
  return <Badge tone={tone}>{label}</Badge>
}

export function scoreColor(score: number | null | undefined) {
  if (score === null || score === undefined) return 'var(--color-fg-subtle)'
  if (score >= 85) return 'var(--color-success)'
  if (score >= 65) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

export function ScorePill({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-fg-subtle">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-fg">
      <span className="size-1.5 rounded-full" style={{ background: scoreColor(score) }} aria-hidden />
      {score}
    </span>
  )
}
