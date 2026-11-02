import { parsePage, parseRobotsTxt } from './parse'
import { readability } from './readability'
import { runChecks, RULES_VERSION } from './checks'
import { scoreAudit } from './scoring'
import type { CategoryScores, CheckRecord, Findings, ImageCheck, Issue, LinkCheck, PageSpeedData, RobotsInfo, SitemapInfo } from './types'
import type { SafeFetchOptions, SafeResponse } from '@/lib/security/safe-fetch'

export type Fetcher = (url: string, opts?: SafeFetchOptions) => Promise<SafeResponse>
export type ProgressStep = 'fetching' | 'robots' | 'links' | 'assets' | 'pagespeed' | 'scoring'
export type AuditEngineResult = { findings: Findings; issues: Issue[]; checks: CheckRecord[]; overall: number; categories: CategoryScores; rulesVersion: string }

export class AuditFetchError extends Error {}

const LINK_SAMPLE = 25
const IMAGE_SAMPLE = 12
const CONCURRENCY = 5

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

function isHtml(contentType: string | null | undefined, body: Buffer) {
  if (contentType && /text\/html|application\/xhtml/i.test(contentType)) return true
  return /<html[\s>]|<!doctype html/i.test(body.subarray(0, 2048).toString('utf8'))
}

async function checkRobots(fetcher: Fetcher, origin: string): Promise<RobotsInfo> {
  try {
    const res = await fetcher(`${origin}/robots.txt`, { maxBytes: 512 * 1024, timeoutMs: 8000, accept: 'text/plain,*/*;q=0.5' })
    if (res.status !== 200) return { found: false, status: res.status, disallowAll: false, sitemaps: [] }
    const body = res.body.toString('utf8')
    if (/<html[\s>]/i.test(body.slice(0, 500))) return { found: false, status: res.status, disallowAll: false, sitemaps: [], error: '/robots.txt returns an HTML page instead of a robots file.' }
    return { found: true, status: 200, ...parseRobotsTxt(body) }
  } catch (err) {
    return { found: false, status: null, disallowAll: false, sitemaps: [], error: `robots.txt could not be fetched: ${(err as Error).message}` }
  }
}

async function checkSitemap(fetcher: Fetcher, origin: string, candidates: string[]): Promise<SitemapInfo> {
  const urls = [...new Set([...candidates.slice(0, 3), `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`])]
  for (const url of urls) {
    try {
      const res = await fetcher(url, { maxBytes: 5 * 1024 * 1024, timeoutMs: 10000, accept: 'application/xml,text/xml,*/*;q=0.5' })
      if (res.status !== 200) continue
      const body = res.body.toString('utf8')
      const isIndex = /<sitemapindex[\s>]/i.test(body)
      if (!isIndex && !/<urlset[\s>]/i.test(body)) continue
      const count = (body.match(/<loc>/gi) ?? []).length
      return { found: true, url, urlCount: res.truncated ? null : count, isIndex }
    } catch {
      /* try next candidate */
    }
  }
  return { found: false, url: null, urlCount: null, isIndex: false }
}

async function checkLinks(fetcher: Fetcher, hrefs: string[], pageUrl: string): Promise<LinkCheck> {
  const unique = [...new Set(hrefs.filter((h) => h !== pageUrl && !/\.(pdf|zip|jpe?g|png|gif|webp|svg|mp4|mp3)(\?|$)/i.test(h)))]
  const sample = unique.slice(0, LINK_SAMPLE)
  const results = await pool(sample, CONCURRENCY, async (url) => {
    try {
      let res = await fetcher(url, { method: 'HEAD', timeoutMs: 8000, maxBytes: 0 })
      if (res.status === 405 || res.status === 501 || res.status === 403) res = await fetcher(url, { method: 'GET', timeoutMs: 8000, maxBytes: 64 * 1024 })
      return { url, status: res.status as number | string }
    } catch (err) {
      return { url, status: (err as Error).message.includes('time') ? 'timeout' : 'unreachable' }
    }
  })
  const broken = results.filter((r) => (typeof r.status === 'number' ? r.status >= 400 && r.status !== 429 : r.status === 'unreachable'))
  return { checked: sample.length, broken, skipped: unique.length - sample.length }
}

async function checkImages(fetcher: Fetcher, srcs: string[]): Promise<ImageCheck> {
  const sample = [...new Set(srcs.filter((s) => /^https?:\/\//.test(s)))].slice(0, IMAGE_SAMPLE)
  const sampled = await pool(sample, CONCURRENCY, async (src) => {
    try {
      const res = await fetcher(src, { method: 'HEAD', timeoutMs: 8000, maxBytes: 0, accept: 'image/*' })
      const len = Number(res.headers['content-length'])
      return { src, bytes: Number.isFinite(len) && len > 0 ? len : null, type: res.headers['content-type']?.split(';')[0] ?? null, status: res.status as number | string }
    } catch {
      return { src, bytes: null, type: null, status: 'unreachable' as number | string }
    }
  })
  return { sampled }
}

export type RunAuditOptions = {
  fetcher: Fetcher
  pagespeed?: (url: string) => Promise<PageSpeedData>
  onProgress?: (step: ProgressStep) => void | Promise<void>
}

/**
 * Deterministic audit engine. Measures the live page and produces findings,
 * issues and scores. AI is never involved here.
 */
export async function runAuditEngine(inputUrl: string, opts: RunAuditOptions): Promise<AuditEngineResult> {
  const started = Date.now()
  const { fetcher } = opts
  await opts.onProgress?.('fetching')
  let main: SafeResponse
  try {
    main = await fetcher(inputUrl, { maxBytes: 3 * 1024 * 1024, timeoutMs: 15000 })
  } catch (err) {
    throw new AuditFetchError((err as Error).message)
  }
  if (!isHtml(main.headers['content-type'], main.body)) {
    throw new AuditFetchError(`The URL did not return an HTML page (content type: ${main.headers['content-type'] ?? 'unknown'}).`)
  }
  const finalUrl = main.url
  const origin = new URL(finalUrl).origin
  const html = main.body.toString('utf8')
  const page = parsePage(html, finalUrl)

  await opts.onProgress?.('robots')
  const httpsCheck = (async () => {
    if (!finalUrl.startsWith('https://')) return { httpRedirectsToHttps: null, detail: 'Site is served over HTTP' }
    try {
      const res = await fetcher(`http://${new URL(finalUrl).host}/`, { maxBytes: 16 * 1024, timeoutMs: 8000 })
      const ok = res.url.startsWith('https://')
      return { httpRedirectsToHttps: ok, detail: ok ? 'HTTP redirects to HTTPS' : `http:// stays on ${res.url}` }
    } catch {
      return { httpRedirectsToHttps: null, detail: 'HTTP version did not respond (port 80 may be closed)' }
    }
  })()
  const robots = await checkRobots(fetcher, origin)
  const [sitemap, https] = await Promise.all([checkSitemap(fetcher, origin, robots.sitemaps), httpsCheck])

  await opts.onProgress?.('links')
  const internal = page.links.filter((l) => l.internal && /^https?:/.test(l.href)).map((l) => l.href)
  const links = await checkLinks(fetcher, internal, finalUrl)

  await opts.onProgress?.('assets')
  const images = await checkImages(fetcher, page.images.map((i) => i.src))

  let pagespeed: PageSpeedData | null = null
  let pagespeedStatus: Findings['pagespeedStatus'] = 'not_configured'
  if (opts.pagespeed) {
    await opts.onProgress?.('pagespeed')
    try {
      pagespeed = await opts.pagespeed(finalUrl)
      pagespeedStatus = 'measured'
    } catch (err) {
      console.warn('[audit] PageSpeed Insights failed:', (err as Error).message)
      pagespeedStatus = 'failed'
    }
  }

  await opts.onProgress?.('scoring')
  const lang = page.lang?.toLowerCase() ?? null
  const read = readability(page.textSample)
  const findings: Findings = {
    fetch: {
      requestedUrl: inputUrl,
      finalUrl,
      status: main.status,
      redirects: main.redirects,
      ttfbMs: main.ttfbMs,
      transferBytes: main.transferBytes,
      htmlBytes: main.body.length,
      truncated: main.truncated,
      contentType: main.headers['content-type'] ?? null,
      contentEncoding: main.headers['content-encoding'] ?? null,
      xRobotsTag: main.headers['x-robots-tag'] ?? null,
      server: main.headers['server']?.slice(0, 80) ?? null,
      cacheControl: main.headers['cache-control']?.slice(0, 120) ?? null,
    },
    page: { ...page, textSample: page.textSample.slice(0, 1500) },
    robots,
    sitemap,
    links,
    images,
    https,
    readability: { ...read, applicable: !lang || lang.startsWith('en') },
    pagespeed,
    pagespeedStatus,
    checks: [],
    durationMs: 0,
  }
  const { issues, checks } = runChecks(findings)
  findings.checks = checks
  findings.durationMs = Date.now() - started
  const { overall, categories } = scoreAudit(issues)
  return { findings, issues, checks, overall, categories, rulesVersion: RULES_VERSION }
}
