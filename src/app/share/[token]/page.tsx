import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Download } from 'lucide-react'
import { RichText } from '@/components/app/rich-text'
import { getSharedReport } from '@/lib/services/reports'
import { loadBrandKitForShare } from '@/lib/pdf/brand'
import { signedAssetUrl } from '@/lib/storage/storage'
import { withSystem } from '@/lib/db'
import { clientIp, rateLimit } from '@/lib/security/rate-limit'
import { AppError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Client report', robots: { index: false, follow: false } }

function Unavailable({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 text-center text-zinc-700">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Report unavailable</h1>
        <p className="mt-2 max-w-sm text-sm">{message}</p>
      </div>
    </div>
  )
}

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    await rateLimit({ key: `share:${clientIp(await headers())}`, limit: 60, windowSeconds: 60 })
  } catch (e) {
    if (e instanceof AppError) return <Unavailable message="Too many requests. Please try again shortly." />
    throw e
  }
  const report = await getSharedReport(token, { countView: true })
  if (!report) return <Unavailable message="This link is invalid, has expired or was revoked by the sender." />
  const brand = await loadBrandKitForShare(report.organizationId)
  const logoPath = await withSystem((tx) => tx.selectFrom('organizations').select('logo_path').where('id', '=', report.organizationId).executeTakeFirst())
  const logoUrl = await signedAssetUrl(report.organizationId, logoPath?.logo_path ?? null, 600)

  return (
    <div className="min-h-dvh bg-zinc-100 py-8 text-zinc-800 sm:py-12">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="h-1.5" style={{ background: brand.brandColor }} />
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-6 py-5 sm:px-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          {logoUrl ? <img src={logoUrl} alt={brand.companyName} className="max-h-9 max-w-40 object-contain" /> : <span className="font-semibold text-zinc-900">{brand.companyName}</span>}
          <a href={`/api/share/${token}/pdf`} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
            <Download className="size-4" aria-hidden /> Download PDF
          </a>
        </header>
        <div className="px-6 py-8 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: brand.accentColor }}>
            Client report · {report.periodLabel}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl">{report.title}</h1>
          {report.clientName ? <p className="mt-1 text-sm text-zinc-500">Prepared for {report.clientName}</p> : null}
          <div className="mt-10 space-y-10">
            {report.sections.map((s, i) => (
              <section key={i}>
                <h2 className="mb-3 text-lg font-semibold" style={{ color: brand.brandColor }}>
                  {s.title}
                </h2>
                {s.kind === 'metrics' && report.metrics.length ? (
                  <div className="mb-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {report.metrics.map((m, j) => (
                        <div key={j} className="rounded-md border border-zinc-200 p-3" style={{ borderTopColor: brand.accentColor, borderTopWidth: 2 }}>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{m.label}</p>
                          <p className="mt-1 text-xl font-bold text-zinc-900">
                            {m.value} {m.unit ? <span className="text-sm font-normal text-zinc-500">{m.unit}</span> : null}
                          </p>
                          {m.previous ? <p className="text-xs text-zinc-500">Previous: {m.previous}</p> : null}
                          <p className="mt-1 text-[11px] text-zinc-400">Source: {m.source}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-400">Metrics provided and verified by {brand.companyName}.</p>
                  </div>
                ) : null}
                {s.content.trim() ? <RichText text={s.content} tone="light" /> : null}
              </section>
            ))}
          </div>
        </div>
        <footer className="flex flex-wrap justify-between gap-2 border-t border-zinc-200 px-6 py-4 text-xs text-zinc-500 sm:px-10">
          <span>{brand.footer || brand.contactLine || brand.companyName}</span>
          {!brand.whiteLabel ? <span>Prepared with AgencyOS AI</span> : null}
        </footer>
      </article>
    </div>
  )
}
