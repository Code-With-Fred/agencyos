import { Text, View } from '@react-pdf/renderer'
import { Blocks, BrandedDocument, C, Cover, pdfText, s } from './primitives'
import type { BrandKit } from './brand'

export type ProposalPdfData = {
  title: string
  template: 'consulting' | 'modern' | 'minimal'
  clientName: string
  clientCompany: string | null
  createdAt: Date
  validUntil: string | null
  currency: string
  sections: { key: string; title: string; content: string }[]
  pricing: { item: string; description: string; amount: number | null }[]
}

function money(n: number | null, currency: string) {
  if (n === null) return 'To be confirmed'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

export function ProposalPdf({ brand, data }: { brand: BrandKit; data: ProposalPdfData }) {
  const total = data.pricing.length && data.pricing.every((p) => p.amount !== null) ? data.pricing.reduce((a, p) => a + (p.amount ?? 0), 0) : null
  const minimal = data.template === 'minimal'
  const sections = data.sections.filter((x) => x.content.trim() || x.key === 'pricing')
  const date = data.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <BrandedDocument
      brand={brand}
      title={data.title}
      kind="Proposal"
      cover={
        minimal ? undefined : (
          <Cover
            brand={brand}
            variant={data.template}
            eyebrow="Proposal"
            title={data.title}
            subtitle={`Prepared for ${data.clientName}${data.clientCompany ? `, ${data.clientCompany}` : ''}`}
            meta={[
              ['Date', date],
              ['Valid until', data.validUntil ? new Date(`${data.validUntil}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'On request'],
              ['Prepared by', brand.companyName],
              ['Investment', money(total, data.currency)],
            ]}
          />
        )
      }
    >
      {minimal ? (
        <View style={{ marginBottom: 18, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 14 }}>
          <Text style={s.h1}>{pdfText(data.title)}</Text>
          <Text style={{ ...s.small, marginTop: 6 }}>
            {pdfText(data.clientName)}
            {data.clientCompany ? ` · ${pdfText(data.clientCompany)}` : ''} · {date}
          </Text>
        </View>
      ) : null}
      {sections.map((sec, i) => (
        <View key={sec.key}>
          <View style={{ ...s.row, alignItems: 'baseline', marginTop: i === 0 ? 0 : 18, marginBottom: 8 }} minPresenceAhead={50}>
            {data.template === 'consulting' ? <Text style={{ fontSize: 10, fontWeight: 700, color: brand.brandColor, width: 24 }}>{String(i + 1).padStart(2, '0')}</Text> : null}
            <Text style={{ fontSize: data.template === 'modern' ? 15 : 13.5, fontWeight: 700, color: data.template === 'modern' ? brand.brandColor : C.ink }}>{pdfText(sec.title)}</Text>
          </View>
          {sec.content.trim() ? <Blocks text={sec.content} /> : null}
          {sec.key === 'pricing' && data.pricing.length ? (
            <View style={{ marginTop: 6 }} wrap={false}>
              <View style={{ ...s.row, borderBottomWidth: 1.5, borderBottomColor: brand.brandColor, paddingBottom: 4 }}>
                <Text style={{ flex: 1, fontWeight: 600, color: C.ink }}>Item</Text>
                <Text style={{ width: 110, textAlign: 'right', fontWeight: 600, color: C.ink }}>Amount</Text>
              </View>
              {data.pricing.map((p, j) => (
                <View key={j} style={{ ...s.row, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5 }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: C.ink }}>{pdfText(p.item)}</Text>
                    {p.description ? <Text style={s.small}>{pdfText(p.description)}</Text> : null}
                  </View>
                  <Text style={{ width: 110, textAlign: 'right' }}>{money(p.amount, data.currency)}</Text>
                </View>
              ))}
              <View style={{ ...s.row, paddingTop: 6 }}>
                <Text style={{ flex: 1, fontWeight: 700, color: C.ink }}>Total</Text>
                <Text style={{ width: 110, textAlign: 'right', fontWeight: 700, color: C.ink }}>{money(total, data.currency)}</Text>
              </View>
            </View>
          ) : null}
        </View>
      ))}
      <View style={{ marginTop: 28, flexDirection: 'row', gap: 24 }} wrap={false}>
        {[`For ${brand.companyName}`, `For ${data.clientCompany ?? data.clientName}`].map((label) => (
          <View key={label} style={{ flex: 1 }}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: C.faint, height: 32 }} />
            <Text style={{ ...s.small, marginTop: 4 }}>{pdfText(label)} — signature & date</Text>
          </View>
        ))}
      </View>
    </BrandedDocument>
  )
}
