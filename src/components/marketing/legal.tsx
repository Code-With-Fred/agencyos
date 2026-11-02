export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: { heading: string; body: string[] }[] }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Legal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-[13px] text-fg-subtle">Last updated {updated}</p>
      <div className="mt-6 rounded-md border border-warning/25 bg-warning-soft/40 px-4 py-3 text-[13px] text-fg-muted">
        This is a template. Have it reviewed by qualified legal counsel and adapt it to your jurisdiction and business before publishing.
      </div>
      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={s.heading}>
            <h2 className="text-base font-semibold">
              {i + 1}. {s.heading}
            </h2>
            {s.body.map((p, j) => (
              <p key={j} className="mt-3 text-[14px] leading-relaxed text-fg-muted">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  )
}
