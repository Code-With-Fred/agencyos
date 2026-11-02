import zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { renderPdf, pdfFilename } from '@/lib/pdf/render'
import { AuditPdf } from '@/lib/pdf/audit-pdf'
import { ProposalPdf } from '@/lib/pdf/proposal-pdf'
import { ReportPdf } from '@/lib/pdf/report-pdf'
import { OnboardingPdf } from '@/lib/pdf/onboarding-pdf'
import { pdfText } from '@/lib/pdf/primitives'
import type { BrandKit } from '@/lib/pdf/brand'
import { runAuditEngine } from '@/lib/audit/run'
import { BAD_HTML } from './fixtures/pages'

/** Minimal valid 1x1 PNG. */
function png(): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0
    for (const b of buf) {
      c ^= b
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    }
    return ~c >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 109, 106, 245, 255]))), chunk('IEND', Buffer.alloc(0))])
}

const brand = (over: Partial<BrandKit> = {}): BrandKit => ({ companyName: 'Northwind Digital', brandColor: '#4F46E5', accentColor: '#0EA5E9', logo: null, footer: 'Confidential — prepared for client use', contactLine: 'northwind.agency · hello@northwind.agency', whiteLabel: false, ...over })

const isPdf = (buf: Buffer) => buf.subarray(0, 5).toString() === '%PDF-' && buf.subarray(-6).toString().includes('%%EOF')

describe('PDF export', () => {
  it('renders a branded audit report from real engine output', async () => {
    const engine = await runAuditEngine('https://bad-site.agencyos-test.com/', {
      fetcher: async (url) => ({ url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(BAD_HTML), transferBytes: 100, truncated: false, ttfbMs: 80, redirects: [] }),
    })
    const buf = await renderPdf(
      <AuditPdf brand={brand({ logo: { data: png(), format: 'png' } })} data={{ url: 'https://bad-site.agencyos-test.com/', clientName: 'Bad Site Co', createdAt: new Date('2026-11-01'), overall: engine.overall, categories: engine.categories, issues: engine.issues, findings: engine.findings, ai: null, preparedBy: 'Northwind Digital' }} />,
    )
    expect(isPdf(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(5000)
  })

  it('renders proposals in all three templates', async () => {
    for (const template of ['consulting', 'modern', 'minimal'] as const) {
      const buf = await renderPdf(
        <ProposalPdf
          brand={brand()}
          data={{
            title: 'SEO Growth Program',
            template,
            clientName: 'Acme',
            clientCompany: 'Acme LLC',
            createdAt: new Date(),
            validUntil: '2026-12-31',
            currency: 'EUR',
            sections: [
              { key: 'executive_summary', title: 'Executive Summary', content: 'We will grow **organic** leads.\n\n## Goals\n- More calls\n- Better rankings → measurable' },
              { key: 'pricing', title: 'Investment', content: 'Total investment below.' },
            ],
            pricing: [
              { item: 'Technical SEO', description: 'Fixes', amount: 4800 },
              { item: 'Content', description: '', amount: null },
            ],
          }}
        />,
      )
      expect(isPdf(buf), template).toBe(true)
    }
  })

  it('renders white-label reports with metrics and onboarding packs', async () => {
    const report = await renderPdf(
      <ReportPdf
        brand={brand({ whiteLabel: true })}
        data={{ title: 'October Report', template: 'detailed', clientName: 'Acme', periodLabel: 'Oct 1 – Oct 31, 2026', updatedAt: new Date(), sections: [{ kind: 'summary', title: 'Executive Summary', content: 'Good month.' }, { kind: 'metrics', title: 'Key Metrics', content: '' }], metrics: [{ label: 'Sessions', value: '12,480', previous: '10,900', unit: '', source: 'GA4', note: '', verified: true }] }}
      />,
    )
    expect(isPdf(report)).toBe(true)
    const onboarding = await renderPdf(
      <OnboardingPdf brand={brand()} data={{ kitTitle: 'Acme — SEO onboarding', clientName: 'Acme', projectType: 'SEO campaign', docs: [{ title: 'Welcome', subject: 'Welcome!', content: 'Hello 👋 team', items: [] }, { title: 'Checklist', subject: null, content: '', items: [{ id: '1', label: 'Share GA4 access', done: true }] }] }} />,
    )
    expect(isPdf(onboarding)).toBe(true)
  })

  it('sanitizes text and filenames', () => {
    expect(pdfText('Hi 👋\u0007 there')).toBe('Hi  there')
    expect(pdfFilename('Report', 'Q4 / "Acme" <script>')).toBe('report-q4-acme-script.pdf')
    expect(pdfFilename()).toBe('document.pdf')
  })
})
