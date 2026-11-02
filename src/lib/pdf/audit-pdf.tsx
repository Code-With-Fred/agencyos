import { Text, View } from '@react-pdf/renderer'
import { BrandedDocument, C, Cover, pdfText, s } from './primitives'
import type { BrandKit } from './brand'
import { CATEGORIES, CATEGORY_LABELS, SEVERITY_LABELS, type CategoryScores, type Findings, type Issue, type Severity } from '@/lib/audit/types'
import { SCORING_EXPLANATION, scoreLabel } from '@/lib/audit/scoring'
import type { AuditAi } from '@/lib/ai/schemas/audit.schema'

const SEV: Record<Severity, string> = { critical: '#e11d48', high: '#ea580c', medium: '#ca8a04', low: '#0284c7', info: '#71717a' }
const scoreHex = (n: number) => (n >= 85 ? '#16a34a' : n >= 65 ? '#d97706' : '#dc2626')

export type AuditPdfData = {
  url: string
  clientName: string | null
  createdAt: Date
  overall: number
  categories: CategoryScores
  issues: Issue[]
  findings: Findings
  ai: AuditAi | null
  preparedBy: string | null
}

export function AuditPdf({ brand, data }: { brand: BrandKit; data: AuditPdfData }) {
  const host = new URL(data.url).host
  const expl = new Map(data.ai?.issue_explanations.map((e) => [e.issue_id, e]) ?? [])
  const byId = new Map(data.issues.map((i) => [i.id, i]))
  return (
    <BrandedDocument
      brand={brand}
      title={`Website Audit — ${host}`}
      kind="Website audit"
      cover={
        <Cover
          brand={brand}
          eyebrow="Website Audit Report"
          title={host}
          subtitle={data.clientName ? `Prepared for ${data.clientName}` : undefined}
          meta={[
            ['Date', data.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
            ['Overall score', `${data.overall}/100 — ${scoreLabel(data.overall)}`],
            ['Issues found', String(data.issues.length)],
            ['Prepared by', pdfText(data.preparedBy ?? brand.companyName)],
          ]}
        />
      }
    >
      <Text style={{ ...s.h2, marginTop: 0 }}>1. Executive summary</Text>
      {data.ai ? (
        <>
          <Text style={s.p}>{pdfText(data.ai.executive_summary)}</Text>
          <Text style={s.p}>{pdfText(data.ai.overall_assessment)}</Text>
        </>
      ) : (
        <Text style={s.p}>
          This audit found {data.issues.length} issue{data.issues.length === 1 ? '' : 's'} across technical SEO, content, performance, accessibility and conversion. The findings below come from automated checks of the live website.
        </Text>
      )}

      <Text style={s.h2}>2. Overall score</Text>
      <View style={{ ...s.row, alignItems: 'center', marginBottom: 6 }} wrap={false}>
        <View style={{ width: 86, height: 86, borderRadius: 43, borderWidth: 6, borderColor: scoreHex(data.overall), alignItems: 'center', justifyContent: 'center', marginRight: 22 }}>
          <Text style={{ fontSize: 24, fontWeight: 700, color: C.ink }}>{data.overall}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {CATEGORIES.map((c) => (
            <View key={c} style={{ marginBottom: 5 }}>
              <View style={{ ...s.row, justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 9 }}>{CATEGORY_LABELS[c]}</Text>
                <Text style={{ fontSize: 9, fontWeight: 600, color: C.ink }}>{data.categories[c]}</Text>
              </View>
              <View style={{ height: 4, backgroundColor: C.soft, borderRadius: 2, marginTop: 2 }}>
                <View style={{ height: 4, width: `${data.categories[c]}%`, backgroundColor: scoreHex(data.categories[c]), borderRadius: 2 }} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <Text style={s.small}>{SCORING_EXPLANATION}</Text>

      {CATEGORIES.map((c, idx) => {
        const list = data.issues.filter((i) => i.category === c)
        return (
          <View key={c}>
            <Text style={s.h2} minPresenceAhead={60}>
              {idx + 3}. {CATEGORY_LABELS[c]}
            </Text>
            {c === 'performance' ? (
              <Text style={{ ...s.small, marginBottom: 6 }}>
                {data.findings.pagespeed
                  ? `PageSpeed Insights (mobile) lab score: ${data.findings.pagespeed.lab.performanceScore ?? 'n/a'}. ${data.findings.pagespeed.field.available ? 'Chrome UX Report field data is included in the findings below.' : 'No Chrome UX Report field data is available for this URL.'}`
                  : 'Core Web Vitals were not measured for this audit (PageSpeed Insights unavailable). No values have been estimated.'}
              </Text>
            ) : null}
            {list.length === 0 ? <Text style={{ ...s.p, color: '#16a34a' }}>No issues found in this category.</Text> : null}
            {list.map((i) => {
              const e = expl.get(i.id)
              return (
                <View key={i.id} style={{ ...s.card, borderLeftWidth: 3, borderLeftColor: SEV[i.severity] }} wrap={false}>
                  <View style={{ ...s.row, justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10.5, fontWeight: 600, color: C.ink, flex: 1 }}>{pdfText(i.title)}</Text>
                    <Text style={{ fontSize: 7.5, fontWeight: 700, color: SEV[i.severity], textTransform: 'uppercase' }}>
                      {SEVERITY_LABELS[i.severity]}
                      {i.estimate ? ' · estimate' : ''}
                    </Text>
                  </View>
                  <Text style={{ ...s.label, marginTop: 6 }}>Evidence</Text>
                  <Text style={{ fontSize: 8.5, color: C.muted }}>{pdfText(i.evidence)}</Text>
                  <Text style={{ ...s.label, marginTop: 5 }}>Explanation</Text>
                  <Text style={{ fontSize: 9 }}>{pdfText(e?.plain_english || i.explanation)}</Text>
                  <Text style={{ ...s.label, marginTop: 5 }}>Recommended fix</Text>
                  <Text style={{ fontSize: 9, color: C.ink }}>{pdfText(e?.recommended_fix || i.recommendation)}</Text>
                </View>
              )
            })}
          </View>
        )
      })}

      <Text style={s.h2} break>
        8. Priority recommendations
      </Text>
      {(data.ai?.priority_recommendations.length ? data.ai.priority_recommendations : data.issues.filter((i) => i.severity !== 'info').slice(0, 8).map((i) => ({ issue_id: i.id, title: i.title, rationale: i.explanation, action: i.recommendation, impact: '', effort: '' }))).map((r, n) => (
        <View key={r.issue_id} style={{ ...s.row, marginBottom: 8 }} wrap={false}>
          <Text style={{ width: 18, fontWeight: 700, color: brand.brandColor }}>{n + 1}.</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 600, color: C.ink }}>
              {pdfText(r.title)} {byId.get(r.issue_id) ? <Text style={{ fontSize: 7.5, color: SEV[byId.get(r.issue_id)!.severity] }}> ({SEVERITY_LABELS[byId.get(r.issue_id)!.severity]})</Text> : null}
            </Text>
            <Text style={{ fontSize: 9 }}>{pdfText(r.rationale)}</Text>
            <Text style={{ fontSize: 9, color: C.ink }}>{pdfText(r.action)}</Text>
            {r.impact ? <Text style={s.small}>Impact: {r.impact} · Effort: {r.effort}</Text> : null}
          </View>
        </View>
      ))}
      {data.ai?.next_steps.length ? (
        <>
          <Text style={s.h3}>Next steps</Text>
          {data.ai.next_steps.map((n, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={s.bullet}>•</Text>
              <Text style={{ flex: 1 }}>{pdfText(n)}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text style={s.h2}>9. Conclusion</Text>
      {data.ai?.conclusion ? <Text style={s.p}>{pdfText(data.ai.conclusion)}</Text> : null}
      <Text style={s.small}>
        Methodology: this audit analysed the server-rendered HTML of {pdfText(data.findings.fetch.finalUrl)} plus robots.txt, the XML sitemap, {data.findings.links.checked} internal links and {data.findings.images.sampled.length} images. JavaScript-rendered content, color contrast, traffic, rankings and backlinks are not measured. Items labelled “estimate” are automated approximations.
        {data.ai ? ' Explanations and recommendations were drafted with AI from the measured findings and reviewed by the agency.' : ''}
      </Text>
    </BrandedDocument>
  )
}
