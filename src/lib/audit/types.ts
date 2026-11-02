export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const
export type Severity = (typeof SEVERITIES)[number]

export const CATEGORIES = ['technical', 'content', 'performance', 'accessibility', 'conversion'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  technical: 'Technical SEO',
  content: 'Content',
  performance: 'Performance',
  accessibility: 'Accessibility',
  conversion: 'Conversion & UX',
}

export const SEVERITY_LABELS: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Informational' }

/** A problem found by a deterministic rule. `evidence` is always measured data. */
export type Issue = {
  id: string
  category: Category
  severity: Severity
  title: string
  evidence: string
  explanation: string
  recommendation: string
  /** True when the measurement is an automated approximation (e.g. readability). */
  estimate?: boolean
  source?: 'html' | 'headers' | 'robots' | 'sitemap' | 'links' | 'assets' | 'pagespeed'
}

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'not_measured' | 'info'
export type CheckRecord = { id: string; category: Category; label: string; status: CheckStatus; detail: string }

export type ImageInfo = { src: string; alt: string | null; width: string | null; height: string | null; loading: string | null; decorative: boolean }
export type LinkInfo = { href: string; text: string; internal: boolean; inNav: boolean; rel: string; accessibleName: string }
export type ScriptInfo = { src: string | null; inHead: boolean; async: boolean; defer: boolean; module: boolean }
export type StylesheetInfo = { href: string; inHead: boolean; media: string | null }
export type InputInfo = { type: string; name: string | null; labelled: boolean }

export type PageData = {
  title: string | null
  metaDescription: string | null
  canonical: string | null
  robotsMeta: string | null
  lang: string | null
  viewport: string | null
  charset: string | null
  hasFavicon: boolean
  openGraph: { title: string | null; description: string | null; image: string | null }
  structuredData: { count: number; types: string[]; invalid: number }
  headings: { level: number; text: string }[]
  wordCount: number
  paragraphCount: number
  textSample: string
  images: ImageInfo[]
  links: LinkInfo[]
  scripts: ScriptInfo[]
  inlineScriptBytes: number
  stylesheets: StylesheetInfo[]
  inlineStyleBytes: number
  forms: { count: number; inputs: InputInfo[]; hasEmailField: boolean; hasTextarea: boolean }
  buttons: { text: string; hasName: boolean }[]
  landmarks: { main: boolean; nav: boolean; header: boolean; footer: boolean }
  iframes: number
  mixedContent: string[]
}

export type FetchMeta = {
  requestedUrl: string
  finalUrl: string
  status: number
  redirects: { url: string; status: number }[]
  ttfbMs: number
  transferBytes: number
  htmlBytes: number
  truncated: boolean
  contentType: string | null
  contentEncoding: string | null
  xRobotsTag: string | null
  server: string | null
  cacheControl: string | null
}

export type RobotsInfo = { found: boolean; status: number | null; disallowAll: boolean; sitemaps: string[]; error?: string }
export type SitemapInfo = { found: boolean; url: string | null; urlCount: number | null; isIndex: boolean; error?: string }
export type LinkCheck = { checked: number; broken: { url: string; status: number | string }[]; skipped: number }
export type ImageCheck = { sampled: { src: string; bytes: number | null; type: string | null; status: number | string }[] }
export type HttpsCheck = { httpRedirectsToHttps: boolean | null; detail: string }

export type PageSpeedData = {
  source: 'pagespeed-insights'
  strategy: 'mobile'
  fetchedAt: string
  lab: { performanceScore: number | null; lcpMs: number | null; cls: number | null; tbtMs: number | null; fcpMs: number | null; speedIndexMs: number | null }
  field: { available: boolean; lcpMs: number | null; inpMs: number | null; cls: number | null; overall: string | null }
}

export type Findings = {
  fetch: FetchMeta
  page: PageData
  robots: RobotsInfo
  sitemap: SitemapInfo
  links: LinkCheck
  images: ImageCheck
  https: HttpsCheck
  readability: { fleschReadingEase: number | null; avgSentenceLength: number | null; applicable: boolean }
  pagespeed: PageSpeedData | null
  pagespeedStatus: 'measured' | 'not_configured' | 'failed'
  checks: CheckRecord[]
  durationMs: number
}

export type CategoryScores = Record<Category, number>
