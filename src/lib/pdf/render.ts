import 'server-only'
import { renderToBuffer } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'

/** Server-side PDF rendering. No user HTML is interpreted — only typed data. */
export async function renderPdf(doc: ReactElement<DocumentProps>): Promise<Buffer> {
  return renderToBuffer(doc)
}

export function pdfFilename(...parts: (string | null | undefined)[]): string {
  const base = parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${base || 'document'}.pdf`
}

export function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
