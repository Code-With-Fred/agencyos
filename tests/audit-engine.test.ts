import { describe, expect, it } from 'vitest'
import { parsePage, parseRobotsTxt } from '@/lib/audit/parse'
import { readability, countSyllables } from '@/lib/audit/readability'
import { scoreAudit, SEVERITY_PENALTY, CATEGORY_WEIGHTS } from '@/lib/audit/scoring'
import { runAuditEngine, AuditFetchError, type Fetcher } from '@/lib/audit/run'
import { parsePageSpeed } from '@/lib/audit/pagespeed'
import type { SafeResponse } from '@/lib/security/safe-fetch'
import { BAD_HTML, GOOD_HTML } from './fixtures/pages'

function res(url: string, status: number, body: string, headers: Record<string, string> = {}): SafeResponse {
  const buf = Buffer.from(body)
  return { url, status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers }, body: buf, transferBytes: buf.length, truncated: false, ttfbMs: 120, redirects: [] }
}

function siteFetcher(pages: Record<string, SafeResponse | Error>): Fetcher {
  return async (url) => {
    const r = pages[url] ?? pages[url.replace(/\/$/, '')]
    if (!r) return res(url, 404, 'not found', { 'content-type': 'text/plain' })
    if (r instanceof Error) throw r
    return r
  }
}

describe('scoring', () => {
  it('starts every category at 100', () => {
    const s = scoreAudit([])
    expect(s.overall).toBe(100)
    expect(Object.values(s.categories).every((v) => v === 100)).toBe(true)
  })
  it('deducts transparent per-severity penalties and floors at 0', () => {
    const s = scoreAudit([
      { category: 'technical', severity: 'critical' },
      { category: 'technical', severity: 'high' },
      { category: 'content', severity: 'low' },
      { category: 'content', severity: 'info' },
    ])
    expect(s.categories.technical).toBe(100 - SEVERITY_PENALTY.critical - SEVERITY_PENALTY.high)
    expect(s.categories.content).toBe(97)
    const floored = scoreAudit(Array.from({ length: 10 }, () => ({ category: 'performance' as const, severity: 'critical' as const })))
    expect(floored.categories.performance).toBe(0)
  })
  it('weights sum to 1 and produce the weighted average', () => {
    expect(Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    const s = scoreAudit([{ category: 'technical', severity: 'critical' }])
    expect(s.overall).toBe(Math.round(70 * 0.3 + 100 * 0.7))
  })
})

describe('HTML parsing (static, no JS execution)', () => {
  it('extracts SEO, content, accessibility and conversion signals', () => {
    const p = parsePage(GOOD_HTML, 'https://acme-plumbing.com/')
    expect(p.title).toContain('Acme Plumbing')
    expect(p.metaDescription?.length).toBeGreaterThan(100)
    expect(p.canonical).toBe('https://acme-plumbing.com/')
    expect(p.lang).toBe('en')
    expect(p.headings.filter((h) => h.level === 1)).toHaveLength(1)
    expect(p.structuredData.types).toContain('Plumber')
    expect(p.forms.inputs.every((i) => i.labelled)).toBe(true)
    expect(p.links.some((l) => l.href.startsWith('tel:'))).toBe(true)
    expect(p.landmarks.main).toBe(true)
    expect(p.wordCount).toBeGreaterThan(300)
  })
  it('detects missing alt, unlabeled inputs and render-blocking scripts', () => {
    const p = parsePage(BAD_HTML, 'https://bad.example-site.com/')
    expect(p.images.filter((i) => i.alt === null)).toHaveLength(2)
    expect(p.forms.inputs.filter((i) => !i.labelled)).toHaveLength(2)
    expect(p.scripts.filter((s) => s.inHead && !s.async && !s.defer)).toHaveLength(4)
    expect(p.links.filter((l) => !l.accessibleName)).toHaveLength(1)
  })
  it('never executes inline scripts', () => {
    const p = parsePage('<html><body><script>globalThis.__pwned = true</script><p>Hi</p></body></html>', 'https://x-site.com/')
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined()
    expect(p.textSample).not.toContain('pwned')
  })
})

describe('robots.txt parsing', () => {
  it('detects disallow-all and sitemaps', () => {
    expect(parseRobotsTxt('User-agent: *\nDisallow: /\nSitemap: https://a.com/s.xml')).toEqual({ disallowAll: true, sitemaps: ['https://a.com/s.xml'] })
    expect(parseRobotsTxt('User-agent: *\nDisallow: /admin').disallowAll).toBe(false)
    expect(parseRobotsTxt('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /').disallowAll).toBe(false)
  })
})

describe('readability (estimate)', () => {
  it('counts syllables heuristically', () => {
    expect(countSyllables('cat')).toBe(1)
    expect(countSyllables('readability')).toBeGreaterThanOrEqual(4)
  })
  it('returns null for too little text', () => expect(readability('Too short.').fleschReadingEase).toBeNull())
  it('scores simple text as easy', () => {
    const r = readability('The cat sat on the mat. The dog ran to the park. We like to play in the sun. '.repeat(10))
    expect(r.fleschReadingEase).toBeGreaterThan(70)
  })
})

describe('runAuditEngine (deterministic, fake network)', () => {
  it('produces a high score with few issues for a well-built site', async () => {
    const origin = 'https://acme-plumbing.com'
    const fetcher = siteFetcher({
      [`${origin}/`]: res(`${origin}/`, 200, GOOD_HTML, { 'content-encoding': 'br' }),
      [`${origin}/robots.txt`]: res(`${origin}/robots.txt`, 200, `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml`, { 'content-type': 'text/plain' }),
      [`${origin}/sitemap.xml`]: res(`${origin}/sitemap.xml`, 200, '<urlset><url><loc>a</loc></url><url><loc>b</loc></url></urlset>', { 'content-type': 'application/xml' }),
      'http://acme-plumbing.com/': res(`${origin}/`, 200, GOOD_HTML),
      [`${origin}/services`]: res(`${origin}/services`, 200, 'ok'),
      [`${origin}/contact`]: res(`${origin}/contact`, 200, 'ok'),
      [`${origin}/team.jpg`]: res(`${origin}/team.jpg`, 200, '', { 'content-type': 'image/jpeg', 'content-length': '45000' }),
    })
    const steps: string[] = []
    const r = await runAuditEngine(`${origin}/`, { fetcher, onProgress: (s) => void steps.push(s) })
    expect(r.overall).toBeGreaterThanOrEqual(85)
    expect(r.issues.find((i) => i.severity === 'critical')).toBeUndefined()
    expect(r.findings.sitemap).toMatchObject({ found: true, urlCount: 2 })
    expect(r.findings.links.broken).toHaveLength(0)
    expect(r.findings.pagespeedStatus).toBe('not_configured')
    expect(r.checks.find((c) => c.id === 'perf.cwv')?.status).toBe('not_measured')
    expect(r.checks.find((c) => c.id === 'a11y.contrast')?.status).toBe('not_measured')
    expect(steps).toEqual(['fetching', 'robots', 'links', 'assets', 'scoring'])
  })

  it('finds critical problems with evidence on a poorly built site', async () => {
    const origin = 'https://bad.example-site.com'
    const fetcher = siteFetcher({
      [`${origin}/`]: res(`${origin}/`, 200, BAD_HTML + ' '.repeat(30_000)),
      [`${origin}/robots.txt`]: res(`${origin}/robots.txt`, 200, 'User-agent: *\nDisallow: /', { 'content-type': 'text/plain' }),
      [`${origin}/broken-page`]: res(`${origin}/broken-page`, 404, 'nope'),
      [`${origin}/about`]: res(`${origin}/about`, 200, 'ok'),
      [`${origin}/hero.png`]: res(`${origin}/hero.png`, 200, '', { 'content-type': 'image/png', 'content-length': '900000' }),
    })
    const r = await runAuditEngine(`${origin}/`, { fetcher })
    const ids = r.issues.map((i) => i.id)
    for (const id of ['tech.noindex', 'tech.robots_txt_blocks_all', 'tech.sitemap_missing', 'tech.title_missing', 'tech.broken_links', 'content.meta_description_missing', 'a11y.img_alt', 'a11y.form_labels', 'a11y.lang', 'a11y.zoom_disabled', 'perf.render_blocking_scripts', 'perf.compression', 'perf.images_heavy', 'ux.cta']) {
      expect(ids, id).toContain(id)
    }
    // A form with an email field counts as a contact option.
    expect(r.checks.find((c) => c.id === 'ux.contact')?.detail).toContain('contact form')
    const broken = r.issues.find((i) => i.id === 'tech.broken_links')!
    expect(broken.evidence).toContain('/broken-page (404)')
    expect(r.overall).toBeLessThan(50)
    // Every issue carries evidence, explanation and a recommended fix.
    for (const i of r.issues) {
      expect(i.evidence.length).toBeGreaterThan(0)
      expect(i.explanation.length).toBeGreaterThan(0)
      expect(i.recommendation.length).toBeGreaterThan(0)
    }
    // Issues are ordered most severe first.
    expect(r.issues[0].severity).toBe('critical')
  })

  it('marks readability findings as estimates and includes PageSpeed only when measured', async () => {
    const origin = 'https://acme-plumbing.com'
    const fetcher = siteFetcher({ [`${origin}/`]: res(`${origin}/`, 200, GOOD_HTML) })
    const r = await runAuditEngine(`${origin}/`, {
      fetcher,
      pagespeed: async () => parsePageSpeed({ lighthouseResult: { categories: { performance: { score: 0.42 } }, audits: { 'largest-contentful-paint': { numericValue: 5200 } } }, loadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4300 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 30 } } } }),
    })
    expect(r.findings.pagespeedStatus).toBe('measured')
    expect(r.issues.find((i) => i.id === 'perf.psi_score')?.severity).toBe('high')
    expect(r.issues.find((i) => i.id === 'perf.cwv_lcp')?.source).toBe('pagespeed')
    expect(r.issues.find((i) => i.id === 'perf.cwv_cls')?.evidence).toContain('0.30')
  })

  it('reports PageSpeed failures as not measured instead of guessing', async () => {
    const origin = 'https://acme-plumbing.com'
    const r = await runAuditEngine(`${origin}/`, { fetcher: siteFetcher({ [`${origin}/`]: res(`${origin}/`, 200, GOOD_HTML) }), pagespeed: async () => Promise.reject(new Error('quota')) })
    expect(r.findings.pagespeed).toBeNull()
    expect(r.findings.pagespeedStatus).toBe('failed')
    expect(r.issues.some((i) => i.source === 'pagespeed')).toBe(false)
  })

  it('fails clearly for non-HTML responses and network errors', async () => {
    await expect(runAuditEngine('https://x-site.com/', { fetcher: siteFetcher({ 'https://x-site.com/': res('https://x-site.com/', 200, '%PDF-1.4', { 'content-type': 'application/pdf' }) }) })).rejects.toBeInstanceOf(AuditFetchError)
    await expect(runAuditEngine('https://x-site.com/', { fetcher: siteFetcher({ 'https://x-site.com/': new Error('The domain name could not be resolved.') }) })).rejects.toThrow('could not be resolved')
  })
})
