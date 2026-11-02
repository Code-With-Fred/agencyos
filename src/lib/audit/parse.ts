import * as cheerio from 'cheerio'
import type { PageData } from './types'

const clean = (s: string | undefined | null) => (s ?? '').replace(/\s+/g, ' ').trim()

function absolute(href: string, base: URL): string | null {
  try {
    const u = new URL(href, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

function sameSite(a: URL, b: URL) {
  const strip = (h: string) => h.replace(/^www\./, '')
  return strip(a.hostname) === strip(b.hostname)
}

/**
 * Parses HTML statically with cheerio. No scripts are executed and no
 * subresources are loaded.
 */
export function parsePage(html: string, pageUrl: string): PageData {
  const $ = cheerio.load(html)
  const base = new URL(pageUrl)
  const baseHref = $('base[href]').attr('href')
  const resolveBase = baseHref ? (absolute(baseHref, base) ? new URL(absolute(baseHref, base)!) : base) : base

  const meta = (name: string) => clean($(`meta[name="${name}" i]`).attr('content')) || null
  const prop = (p: string) => clean($(`meta[property="${p}" i]`).attr('content')) || null

  // Structured data
  let sdCount = 0
  let sdInvalid = 0
  const sdTypes = new Set<string>()
  $('script[type="application/ld+json"]').each((_, el) => {
    sdCount++
    try {
      const data = JSON.parse($(el).text())
      const visit = (node: unknown) => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) return node.forEach(visit)
        const obj = node as Record<string, unknown>
        const t = obj['@type']
        if (typeof t === 'string') sdTypes.add(t)
        else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && sdTypes.add(x))
        if (obj['@graph']) visit(obj['@graph'])
      }
      visit(data)
    } catch {
      sdInvalid++
    }
  })

  const headings: PageData['headings'] = []
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    headings.push({ level: Number(el.tagName.slice(1)), text: clean($(el).text()).slice(0, 200) })
  })

  // Images
  const images: PageData['images'] = []
  $('img').each((_, el) => {
    const $el = $(el)
    const src = $el.attr('src') || $el.attr('data-src') || ''
    const abs = src && !src.startsWith('data:') ? absolute(src, resolveBase) : null
    const altAttr = $el.attr('alt')
    images.push({
      src: abs ?? (src.startsWith('data:') ? 'data:' : src.slice(0, 300)),
      alt: altAttr === undefined ? null : clean(altAttr),
      width: $el.attr('width') ?? null,
      height: $el.attr('height') ?? null,
      loading: $el.attr('loading')?.toLowerCase() ?? null,
      decorative: $el.attr('role') === 'presentation' || $el.attr('aria-hidden') === 'true',
    })
  })

  // Links
  const links: PageData['links'] = []
  $('a[href]').each((_, el) => {
    const $el = $(el)
    const raw = ($el.attr('href') ?? '').trim()
    const text = clean($el.text()).slice(0, 200)
    const imgAlt = clean($el.find('img[alt]').first().attr('alt'))
    const accessibleName = clean($el.attr('aria-label')) || text || imgAlt || clean($el.attr('title')) || ($el.attr('aria-labelledby') ? 'labelledby' : '')
    const inNav = $el.closest('nav, [role="navigation"], header').length > 0
    if (/^(tel|mailto):/i.test(raw)) {
      links.push({ href: raw.slice(0, 300), text, internal: false, inNav, rel: $el.attr('rel') ?? '', accessibleName })
      return
    }
    const abs = absolute(raw, resolveBase)
    if (!abs) return
    links.push({ href: abs, text, internal: sameSite(new URL(abs), base), inNav, rel: $el.attr('rel') ?? '', accessibleName })
  })

  // Scripts & styles
  const scripts: PageData['scripts'] = []
  let inlineScriptBytes = 0
  $('script').each((_, el) => {
    const $el = $(el)
    const type = ($el.attr('type') ?? '').toLowerCase()
    if (type && !['text/javascript', 'module', 'application/javascript'].includes(type)) return
    const src = $el.attr('src')
    if (!src) inlineScriptBytes += Buffer.byteLength($el.text())
    scripts.push({
      src: src ? (absolute(src, resolveBase) ?? src) : null,
      inHead: $el.closest('head').length > 0,
      async: $el.attr('async') !== undefined,
      defer: $el.attr('defer') !== undefined,
      module: type === 'module',
    })
  })
  const stylesheets: PageData['stylesheets'] = []
  $('link[rel~="stylesheet" i]').each((_, el) => {
    const $el = $(el)
    const href = $el.attr('href')
    if (!href) return
    stylesheets.push({ href: absolute(href, resolveBase) ?? href, inHead: $el.closest('head').length > 0, media: $el.attr('media') ?? null })
  })
  let inlineStyleBytes = 0
  $('style').each((_, el) => {
    inlineStyleBytes += Buffer.byteLength($(el).text())
  })

  // Forms & labels
  const inputs: PageData['forms']['inputs'] = []
  $('input, select, textarea').each((_, el) => {
    const $el = $(el)
    const type = (el.tagName === 'input' ? ($el.attr('type') ?? 'text') : el.tagName).toLowerCase()
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return
    const id = $el.attr('id')
    const labelled =
      Boolean(clean($el.attr('aria-label'))) ||
      Boolean($el.attr('aria-labelledby')) ||
      Boolean(clean($el.attr('title'))) ||
      $el.closest('label').length > 0 ||
      (id ? $(`label[for="${id.replace(/"/g, '\\"')}"]`).length > 0 : false)
    inputs.push({ type, name: $el.attr('name') ?? null, labelled })
  })
  const buttons: PageData['buttons'] = []
  $('button, [role="button"], input[type="submit"], input[type="button"]').each((_, el) => {
    const $el = $(el)
    const text = clean($el.text()) || clean($el.attr('value'))
    const name = clean($el.attr('aria-label')) || text || clean($el.attr('title')) || clean($el.find('img[alt]').attr('alt')) || ($el.attr('aria-labelledby') ? 'labelledby' : '')
    buttons.push({ text: text.slice(0, 120), hasName: Boolean(name) })
  })

  // Mixed content
  const mixed: string[] = []
  if (base.protocol === 'https:') {
    $('img[src^="http:"], script[src^="http:"], link[rel~="stylesheet"][href^="http:"], iframe[src^="http:"]').each((_, el) => {
      const v = $(el).attr('src') ?? $(el).attr('href')
      if (v && mixed.length < 20) mixed.push(v.slice(0, 300))
    })
  }

  // Body text (static content only)
  const $body = $('body').clone()
  $body.find('script, style, noscript, svg, template, iframe').remove()
  const text = clean($body.text())
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []

  return {
    title: clean($('head title').first().text() || $('title').first().text()) || null,
    metaDescription: meta('description'),
    canonical: (() => {
      const c = $('link[rel="canonical" i]').attr('href')
      return c ? absolute(c, resolveBase) : null
    })(),
    robotsMeta: meta('robots'),
    lang: clean($('html').attr('lang')) || null,
    viewport: meta('viewport'),
    charset: $('meta[charset]').attr('charset') ?? ($('meta[http-equiv="content-type" i]').attr('content')?.match(/charset=([^;]+)/i)?.[1] ?? null),
    hasFavicon: $('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon" i]').length > 0,
    openGraph: { title: prop('og:title'), description: prop('og:description'), image: prop('og:image') },
    structuredData: { count: sdCount, types: [...sdTypes].slice(0, 20), invalid: sdInvalid },
    headings,
    wordCount: words.length,
    paragraphCount: $('p').filter((_, el) => clean($(el).text()).length > 40).length,
    textSample: text.slice(0, 20000),
    images,
    links,
    scripts,
    inlineScriptBytes,
    stylesheets,
    inlineStyleBytes,
    forms: { count: $('form').length, inputs, hasEmailField: $('input[type="email" i], input[name*="email" i]').length > 0, hasTextarea: $('textarea').length > 0 },
    buttons,
    landmarks: {
      main: $('main, [role="main"]').length > 0,
      nav: $('nav, [role="navigation"]').length > 0,
      header: $('header, [role="banner"]').length > 0,
      footer: $('footer, [role="contentinfo"]').length > 0,
    },
    iframes: $('iframe').length,
    mixedContent: mixed,
  }
}

export function parseRobotsTxt(body: string): { disallowAll: boolean; sitemaps: string[] } {
  const lines = body.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean)
  const sitemaps: string[] = []
  let currentAgents: string[] = []
  let lastWasAgent = false
  const rules = new Map<string, string[]>()
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (key === 'sitemap') {
      if (value && sitemaps.length < 20) sitemaps.push(value)
      continue
    }
    if (key === 'user-agent') {
      currentAgents = lastWasAgent ? [...currentAgents, value.toLowerCase()] : [value.toLowerCase()]
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (key === 'disallow' || key === 'allow') {
      for (const a of currentAgents) {
        const arr = rules.get(a) ?? []
        arr.push(`${key}:${value}`)
        rules.set(a, arr)
      }
    }
  }
  const star = rules.get('*') ?? []
  const disallowAll = star.includes('disallow:/') && !star.some((r) => r.startsWith('allow:') && r.length > 'allow:'.length)
  return { disallowAll, sitemaps }
}
