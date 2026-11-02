import 'server-only'
import { z } from 'zod'
import type { PageSpeedData } from './types'

const metric = z.object({ percentile: z.number().optional(), category: z.string().optional() }).optional()
const audit = z.object({ numericValue: z.number().optional() }).optional()
const psiSchema = z.object({
  lighthouseResult: z
    .object({
      categories: z.object({ performance: z.object({ score: z.number().nullable().optional() }).optional() }).optional(),
      audits: z
        .object({
          'largest-contentful-paint': audit,
          'cumulative-layout-shift': audit,
          'total-blocking-time': audit,
          'first-contentful-paint': audit,
          'speed-index': audit,
        })
        .partial()
        .optional(),
    })
    .optional(),
  loadingExperience: z
    .object({
      overall_category: z.string().optional(),
      metrics: z
        .object({
          LARGEST_CONTENTFUL_PAINT_MS: metric,
          INTERACTION_TO_NEXT_PAINT: metric,
          CUMULATIVE_LAYOUT_SHIFT_SCORE: metric,
        })
        .partial()
        .optional(),
    })
    .optional(),
})

/**
 * Calls Google PageSpeed Insights v5 (fixed Google endpoint — the audited
 * URL is only a query parameter, so there is no SSRF surface here).
 */
export async function fetchPageSpeed(url: string, apiKey: string, timeoutMs = 50000): Promise<PageSpeedData> {
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  endpoint.searchParams.set('url', url)
  endpoint.searchParams.set('strategy', 'mobile')
  endpoint.searchParams.set('category', 'performance')
  endpoint.searchParams.set('key', apiKey)
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`PageSpeed Insights responded ${res.status}`)
  return parsePageSpeed(await res.json())
}

export function parsePageSpeed(json: unknown): PageSpeedData {
  const data = psiSchema.parse(json)
  const a = data.lighthouseResult?.audits ?? {}
  const score = data.lighthouseResult?.categories?.performance?.score
  const m = data.loadingExperience?.metrics ?? {}
  const clsRaw = m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
  const available = Boolean(m.LARGEST_CONTENTFUL_PAINT_MS?.percentile || m.INTERACTION_TO_NEXT_PAINT?.percentile || clsRaw !== undefined)
  return {
    source: 'pagespeed-insights',
    strategy: 'mobile',
    fetchedAt: new Date().toISOString(),
    lab: {
      performanceScore: typeof score === 'number' ? Math.round(score * 100) : null,
      lcpMs: a['largest-contentful-paint']?.numericValue ?? null,
      cls: a['cumulative-layout-shift']?.numericValue ?? null,
      tbtMs: a['total-blocking-time']?.numericValue ?? null,
      fcpMs: a['first-contentful-paint']?.numericValue ?? null,
      speedIndexMs: a['speed-index']?.numericValue ?? null,
    },
    field: {
      available,
      lcpMs: m.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
      inpMs: m.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
      // CrUX reports CLS percentile multiplied by 100.
      cls: clsRaw !== undefined ? clsRaw / 100 : null,
      overall: data.loadingExperience?.overall_category ?? null,
    },
  }
}
