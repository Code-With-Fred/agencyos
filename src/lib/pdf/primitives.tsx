import path from 'node:path'
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { BrandKit } from './brand'
import { toBlocks } from '@/lib/content/blocks'

let registered = false
export function registerFonts() {
  if (registered) return
  const dir = path.join(process.cwd(), 'assets', 'fonts')
  Font.register({
    family: 'Geist',
    fonts: [
      { src: path.join(dir, 'Geist-Regular.ttf'), fontWeight: 400 },
      { src: path.join(dir, 'Geist-Medium.ttf'), fontWeight: 500 },
      { src: path.join(dir, 'Geist-SemiBold.ttf'), fontWeight: 600 },
      { src: path.join(dir, 'Geist-Bold.ttf'), fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((w) => [w])
  registered = true
}

/** Removes characters the embedded font cannot draw (e.g. emoji, control chars). */
export function pdfText(s: string | null | undefined): string {
  return (s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}️]/gu, '')
}

export const C = { ink: '#18181b', body: '#3f3f46', muted: '#71717a', faint: '#a1a1aa', line: '#e4e4e7', soft: '#f4f4f5', white: '#ffffff' }

export const s = StyleSheet.create({
  page: { fontFamily: 'Geist', fontSize: 10, color: C.body, paddingTop: 64, paddingBottom: 60, paddingHorizontal: 48, lineHeight: 1.5 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, height: 44, paddingHorizontal: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.faint, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  h1: { fontSize: 24, fontWeight: 700, color: C.ink, lineHeight: 1.2 },
  h2: { fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 8, marginTop: 18 },
  h3: { fontSize: 11, fontWeight: 600, color: C.ink, marginBottom: 4, marginTop: 6 },
  p: { marginBottom: 6 },
  small: { fontSize: 8.5, color: C.muted },
  label: { fontSize: 7.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row' },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 10, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bullet: { width: 12, color: C.muted },
})

export function BrandMark({ brand, height = 20 }: { brand: BrandKit; height?: number }) {
  if (brand.logo) {
    // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
    return <Image src={{ data: brand.logo.data, format: brand.logo.format }} style={{ height, maxWidth: 140, objectFit: 'contain' }} />
  }
  return <Text style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{pdfText(brand.companyName)}</Text>
}

export function Blocks({ text }: { text: string }) {
  return (
    <View>
      {toBlocks(pdfText(text)).map((b, i) =>
        b.type === 'heading' ? (
          <Text key={i} style={s.h3}>
            {b.text}
          </Text>
        ) : b.type === 'list' ? (
          <View key={i} style={{ marginBottom: 6 }}>
            {b.items.map((it, j) => (
              <View key={j} style={s.bulletRow} wrap={false}>
                <Text style={s.bullet}>{b.ordered ? `${j + 1}.` : '•'}</Text>
                <Text style={{ flex: 1 }}>{it}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text key={i} style={s.p}>
            {b.text}
          </Text>
        ),
      )}
    </View>
  )
}

/** Branded page frame: fixed header, footer with page numbers and (when not white-label) attribution. */
export function BrandedDocument({ brand, title, kind, children, cover }: { brand: BrandKit; title: string; kind: string; children: React.ReactNode; cover?: React.ReactNode }) {
  registerFonts()
  const footerLeft = pdfText(brand.footer || brand.contactLine || brand.companyName)
  return (
    <Document title={pdfText(title)} author={pdfText(brand.companyName)} creator={brand.whiteLabel ? pdfText(brand.companyName) : 'AgencyOS AI'} producer={brand.whiteLabel ? pdfText(brand.companyName) : 'AgencyOS AI'}>
      {cover ? (
        <Page size="A4" style={{ ...s.page, paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }}>
          {cover}
        </Page>
      ) : null}
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <BrandMark brand={brand} height={16} />
          <Text style={{ fontSize: 7.5, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.8 }}>{pdfText(kind)}</Text>
        </View>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: brand.brandColor }} fixed />
        {children}
        <View style={s.footer} fixed>
          <Text style={{ maxWidth: 360 }}>{footerLeft}</Text>
          <Text render={({ pageNumber, totalPages }) => `${brand.whiteLabel ? '' : 'Prepared with AgencyOS AI  ·  '}Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export function Cover({ brand, eyebrow, title, subtitle, meta, variant = 'consulting' }: { brand: BrandKit; eyebrow: string; title: string; subtitle?: string; meta: [string, string][]; variant?: 'consulting' | 'modern' | 'minimal' }) {
  const modern = variant === 'modern'
  return (
    <View style={{ flex: 1, backgroundColor: modern ? brand.brandColor : C.white }}>
      {!modern ? <View style={{ height: 8, backgroundColor: brand.brandColor }} /> : null}
      <View style={{ padding: 56, flex: 1, justifyContent: 'space-between' }}>
        <View>{modern ? <Text style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{pdfText(brand.companyName)}</Text> : <BrandMark brand={brand} height={28} />}</View>
        <View>
          <Text style={{ ...s.label, color: modern ? '#ffffffcc' : brand.accentColor, fontSize: 9 }}>{pdfText(eyebrow)}</Text>
          <Text style={{ ...s.h1, fontSize: 30, marginTop: 10, color: modern ? C.white : C.ink }}>{pdfText(title)}</Text>
          {subtitle ? <Text style={{ fontSize: 13, marginTop: 10, color: modern ? '#ffffffdd' : C.muted }}>{pdfText(subtitle)}</Text> : null}
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: modern ? '#ffffff55' : C.line, paddingTop: 16, flexDirection: 'row', flexWrap: 'wrap' }}>
          {meta.map(([k, v]) => (
            <View key={k} style={{ width: '50%', marginBottom: 10 }}>
              <Text style={{ ...s.label, color: modern ? '#ffffffaa' : C.muted }}>{pdfText(k)}</Text>
              <Text style={{ marginTop: 2, color: modern ? C.white : C.ink }}>{pdfText(v)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
