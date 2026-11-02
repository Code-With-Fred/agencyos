import { RichText } from '@/components/app/rich-text'
import { formatDate, formatMoney } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Props = {
  template: string
  title: string
  clientName: string
  clientCompany: string | null
  agencyName: string
  brandColor: string
  logoUrl: string | null
  validUntil: string | null
  createdAt: Date
  currency: string
  sections: { key: string; title: string; content: string }[]
  pricing: { item: string; description: string; amount: number | null }[]
}

/** On-screen preview of the client-facing proposal (mirrors the PDF layout). */
export function ProposalDocument(p: Props) {
  const modern = p.template === 'modern'
  const minimal = p.template === 'minimal'
  const total = p.pricing.length && p.pricing.every((i) => i.amount !== null) ? p.pricing.reduce((s, i) => s + (i.amount ?? 0), 0) : null
  return (
    <article className="mx-auto max-w-3xl overflow-hidden rounded-lg bg-white text-zinc-800 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
      {!minimal ? (
        <header className={cn('px-10 py-12', modern ? 'text-white' : 'border-t-8')} style={modern ? { background: p.brandColor } : { borderTopColor: p.brandColor }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          {p.logoUrl && !modern ? <img src={p.logoUrl} alt="" className="mb-10 max-h-10 max-w-40 object-contain" /> : <p className={cn('mb-10 text-sm font-bold', modern ? 'text-white' : 'text-zinc-900')}>{p.agencyName}</p>}
          <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', modern ? 'text-white/80' : '')} style={modern ? undefined : { color: p.brandColor }}>
            Proposal
          </p>
          <h1 className={cn('mt-3 text-3xl font-bold leading-tight', modern ? 'text-white' : 'text-zinc-900')}>{p.title}</h1>
          <p className={cn('mt-3 text-sm', modern ? 'text-white/85' : 'text-zinc-500')}>
            Prepared for {p.clientName}
            {p.clientCompany ? `, ${p.clientCompany}` : ''} · {formatDate(p.createdAt)}
            {p.validUntil ? ` · Valid until ${formatDate(p.validUntil)}` : ''}
          </p>
        </header>
      ) : (
        <header className="border-b border-zinc-200 px-10 pb-6 pt-10">
          <p className="text-sm font-semibold text-zinc-900">{p.agencyName}</p>
          <h1 className="mt-6 text-2xl font-semibold text-zinc-900">{p.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {p.clientName}
            {p.clientCompany ? ` · ${p.clientCompany}` : ''} · {formatDate(p.createdAt)}
          </p>
        </header>
      )}
      <div className="space-y-9 px-10 py-10">
        {p.sections
          .filter((s) => s.content.trim() || s.key === 'pricing')
          .map((s, i) => (
            <section key={s.key}>
              <h2 className={cn('mb-3 font-semibold text-zinc-900', minimal ? 'text-base' : 'text-lg')}>
                {p.template === 'consulting' ? <span className="mr-2 font-mono text-sm" style={{ color: p.brandColor }}>{String(i + 1).padStart(2, '0')}</span> : null}
                {s.title}
              </h2>
              {s.content.trim() ? <RichText text={s.content} tone="light" /> : null}
              {s.key === 'pricing' && p.pricing.length ? (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b-2" style={{ borderColor: p.brandColor }}>
                      <th className="py-2 text-left font-semibold text-zinc-900">Item</th>
                      <th className="py-2 text-right font-semibold text-zinc-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.pricing.map((it, j) => (
                      <tr key={j} className="border-b border-zinc-200">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium text-zinc-900">{it.item}</p>
                          {it.description ? <p className="text-xs text-zinc-500">{it.description}</p> : null}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{it.amount === null ? 'To be confirmed' : formatMoney(it.amount, p.currency)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-3 font-semibold text-zinc-900">Total</td>
                      <td className="py-3 text-right font-semibold tabular-nums text-zinc-900">{total === null ? 'To be confirmed' : formatMoney(total, p.currency)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : null}
            </section>
          ))}
      </div>
    </article>
  )
}
