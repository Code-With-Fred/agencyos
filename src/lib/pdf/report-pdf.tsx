import { Text, View } from '@react-pdf/renderer'
import { Blocks, BrandedDocument, C, Cover, pdfText, s } from './primitives'
import type { BrandKit } from './brand'
import type { ReportMetric } from '@/lib/ai/schemas/report.schema'

export type ReportPdfData = {
  title: string
  template: string
  clientName: string | null
  periodLabel: string
  updatedAt: Date
  sections: { kind: string; title: string; content: string }[]
  metrics: ReportMetric[]
}

export function MetricsTable({ metrics, brand }: { metrics: ReportMetric[]; brand: BrandKit }) {
  if (!metrics.length) return null
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
        {metrics.map((m, i) => (
          <View key={i} style={{ width: '33.33%', padding: 4 }} wrap={false}>
            <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 8, borderTopWidth: 2, borderTopColor: brand.accentColor }}>
              <Text style={s.label}>{pdfText(m.label)}</Text>
              <Text style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginTop: 3 }}>
                {pdfText(m.value)}
                {m.unit ? <Text style={{ fontSize: 9, color: C.muted }}> {pdfText(m.unit)}</Text> : null}
              </Text>
              {m.previous ? <Text style={s.small}>Previous: {pdfText(m.previous)}</Text> : null}
              <Text style={{ fontSize: 7, color: C.faint, marginTop: 2 }}>Source: {pdfText(m.source)}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 7, color: C.faint, marginTop: 4 }}>Metrics provided and verified by {pdfText(brand.companyName)}.</Text>
    </View>
  )
}

export function ReportPdf({ brand, data }: { brand: BrandKit; data: ReportPdfData }) {
  return (
    <BrandedDocument
      brand={brand}
      title={data.title}
      kind="Client report"
      cover={
        data.template === 'detailed' ? (
          <Cover
            brand={brand}
            eyebrow="Client Report"
            title={data.title}
            subtitle={data.clientName ? `Prepared for ${data.clientName}` : undefined}
            meta={[
              ['Reporting period', data.periodLabel],
              ['Prepared by', brand.companyName],
              ['Issued', data.updatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
            ]}
          />
        ) : undefined
      }
    >
      {data.template !== 'detailed' ? (
        <View style={{ marginBottom: 14 }}>
          <Text style={{ ...s.label, color: brand.accentColor }}>Client report · {pdfText(data.periodLabel)}</Text>
          <Text style={{ ...s.h1, marginTop: 6 }}>{pdfText(data.title)}</Text>
          {data.clientName ? <Text style={{ ...s.small, marginTop: 4 }}>Prepared for {pdfText(data.clientName)}</Text> : null}
        </View>
      ) : null}
      {data.sections.map((sec, i) => (
        <View key={i}>
          <Text style={{ ...s.h2, marginTop: i === 0 ? 0 : 16, color: brand.brandColor }} minPresenceAhead={50}>
            {pdfText(sec.title)}
          </Text>
          {sec.kind === 'metrics' ? <MetricsTable metrics={data.metrics} brand={brand} /> : null}
          {sec.content.trim() ? <Blocks text={sec.content} /> : null}
        </View>
      ))}
    </BrandedDocument>
  )
}
