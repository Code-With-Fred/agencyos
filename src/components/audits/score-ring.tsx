import { scoreColor } from '@/components/app/status'

export function ScoreRing({ score, size = 112, label }: { score: number; size?: number; label?: string }) {
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Score ${score} out of 100`}>
        <circle cx="50" cy="50" r={r} stroke="var(--color-elevated)" strokeWidth="8" fill="none" />
        <circle cx="50" cy="50" r={r} stroke={scoreColor(score)} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
        <text x="50" y="56" textAnchor="middle" fill="var(--color-fg)" fontSize="24" fontWeight="600">
          {score}
        </text>
      </svg>
      {label ? <span className="mt-1 text-xs text-fg-muted">{label}</span> : null}
    </div>
  )
}
