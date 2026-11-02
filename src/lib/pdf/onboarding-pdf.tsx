import { Text, View } from '@react-pdf/renderer'
import { Blocks, BrandedDocument, C, pdfText, s } from './primitives'
import type { BrandKit } from './brand'
import type { ChecklistItem } from '@/lib/ai/schemas/onboarding.schema'

export type OnboardingPdfData = {
  kitTitle: string
  clientName: string | null
  projectType: string
  docs: { title: string; subject: string | null; content: string; items: ChecklistItem[] }[]
}

export function OnboardingPdf({ brand, data }: { brand: BrandKit; data: OnboardingPdfData }) {
  return (
    <BrandedDocument brand={brand} title={data.kitTitle} kind="Client onboarding">
      <Text style={{ ...s.label, color: brand.accentColor }}>{pdfText(data.projectType)}</Text>
      <Text style={{ ...s.h1, marginTop: 6, marginBottom: 4 }}>{pdfText(data.kitTitle)}</Text>
      {data.clientName ? <Text style={s.small}>Prepared for {pdfText(data.clientName)}</Text> : null}
      {data.docs.map((d, i) => (
        <View key={i} break={i > 0}>
          <Text style={{ ...s.h2, color: brand.brandColor }}>{pdfText(d.title)}</Text>
          {d.subject ? <Text style={{ ...s.small, marginBottom: 8 }}>Subject: {pdfText(d.subject)}</Text> : null}
          {d.content.trim() ? <Blocks text={d.content} /> : null}
          {d.items.length ? (
            <View style={{ marginTop: 6 }}>
              {d.items.map((it) => (
                <View key={it.id} style={{ ...s.row, alignItems: 'center', marginBottom: 5 }} wrap={false}>
                  <View style={{ width: 10, height: 10, borderWidth: 1, borderColor: C.muted, borderRadius: 2, marginRight: 8, backgroundColor: it.done ? brand.accentColor : C.white }} />
                  <Text style={{ flex: 1, color: it.done ? C.muted : C.body }}>{pdfText(it.label)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </BrandedDocument>
  )
}
