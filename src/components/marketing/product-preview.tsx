import { CheckCircle2, CircleAlert, FileText, Gauge, LayoutDashboard, Search, Users } from 'lucide-react'

/**
 * A static rendering of the audit report UI, used on marketing pages. The
 * values are illustrative and labelled as an example — they are not
 * measurements of any real website.
 */
const issues = [
  { sev: 'Critical', color: 'var(--color-sev-critical)', title: 'Homepage is blocked by a noindex directive', cat: 'Technical SEO' },
  { sev: 'High', color: 'var(--color-sev-high)', title: '3 form inputs have no accessible label', cat: 'Accessibility' },
  { sev: 'Medium', color: 'var(--color-sev-medium)', title: '7 render-blocking scripts in <head>', cat: 'Performance' },
  { sev: 'Low', color: 'var(--color-sev-low)', title: 'Meta description is 212 characters', cat: 'Content' },
]

function ScoreRing({ value }: { value: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 72 72" className="size-20" aria-hidden>
      <circle cx="36" cy="36" r={r} stroke="#232329" strokeWidth="6" fill="none" />
      <circle cx="36" cy="36" r={r} stroke="#6d6af5" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 36 36)" />
      <text x="36" y="41" textAnchor="middle" fill="#ededf0" fontSize="17" fontWeight="600">
        {value}
      </text>
    </svg>
  )
}

export function ProductPreview() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
        <div className="flex h-9 items-center gap-1.5 border-b border-border bg-elevated px-3">
          <span className="size-2.5 rounded-full bg-[#3a3a42]" />
          <span className="size-2.5 rounded-full bg-[#3a3a42]" />
          <span className="size-2.5 rounded-full bg-[#3a3a42]" />
          <span className="ml-3 text-2xs text-fg-subtle">app / website audits / example-client.com</span>
        </div>
        <div className="grid md:grid-cols-[180px_1fr]">
          <aside className="hidden border-r border-border p-3 md:block">
            {[
              [LayoutDashboard, 'Overview'],
              [Users, 'Clients'],
              [Search, 'Website Audits'],
              [FileText, 'Proposals'],
              [Gauge, 'Reports'],
            ].map(([Icon, label], i) => {
              const I = Icon as typeof Users
              return (
                <div key={label as string} className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${i === 2 ? 'bg-hover text-fg' : 'text-fg-muted'}`}>
                  <I className="size-3.5" /> {label as string}
                </div>
              )
            })}
          </aside>
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-5">
              <ScoreRing value={68} />
              <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
                {[
                  ['Technical', 54],
                  ['Content', 77],
                  ['Performance', 62],
                  ['Accessibility', 71],
                  ['Conversion', 85],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <p className="text-2xs text-fg-subtle">{k}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 rounded-full bg-elevated">
                        <div className="h-1 rounded-full bg-accent" style={{ width: `${v}%` }} />
                      </div>
                      <span className="text-2xs tabular-nums text-fg-muted">{v}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-border">
              {issues.map((i) => (
                <div key={i.title} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0">
                  <CircleAlert className="size-3.5 shrink-0" style={{ color: i.color }} />
                  <span className="w-14 shrink-0 text-2xs font-medium" style={{ color: i.color }}>
                    {i.sev}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-fg">{i.title}</span>
                  <span className="hidden text-2xs text-fg-subtle sm:inline">{i.cat}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-accent/20 bg-accent-soft/60 p-3">
              <p className="flex items-center gap-1.5 text-2xs font-medium text-[#a9a7ff]">
                <CheckCircle2 className="size-3" /> AI executive summary
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                The most urgent fix is removing the noindex directive, which prevents search engines from listing the homepage. Next, label the contact form fields…
              </p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-2xs text-fg-subtle">Product preview with example data.</p>
    </div>
  )
}
