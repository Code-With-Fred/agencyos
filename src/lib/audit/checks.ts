import type { CheckRecord, Findings, Issue } from './types'
import { formatBytesPlain } from './format'

export const RULES_VERSION = '2026.11.1'

const CTA_PATTERN = /\b(get started|start (now|today|free|your)|contact( us)?|book|schedule|request|get a (quote|demo|proposal)|quote|buy|shop|order|sign ?up|subscribe|try|demo|call (us|now)|enquire|inquire|hire|apply|download|register|join|talk to|free consultation|learn more)\b/i
const GENERIC_ALT = /^(image|img|photo|picture|graphic|logo|icon|banner|untitled|dsc_?\d+|img_?\d+|screenshot.*|.*\.(jpe?g|png|webp|gif|avif|svg))$/i

type Ctx = { f: Findings; issues: Issue[]; checks: CheckRecord[] }

function add(c: Ctx, issue: Issue) {
  c.issues.push(issue)
}
function rec(c: Ctx, check: CheckRecord) {
  c.checks.push(check)
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const list = (items: string[], max = 5) => items.slice(0, max).join(', ') + (items.length > max ? ` and ${items.length - max} more` : '')

function technical(c: Ctx) {
  const { fetch, page, robots, sitemap, links, https } = c.f

  if (fetch.status >= 400) {
    add(c, { id: 'tech.http_status', category: 'technical', severity: 'critical', title: `Page returns HTTP ${fetch.status}`, evidence: `GET ${fetch.finalUrl} responded with status ${fetch.status}.`, explanation: 'Search engines do not index pages that return error status codes, and visitors see an error instead of content.', recommendation: 'Fix the server or routing error so the page returns HTTP 200.', source: 'headers' })
  }
  rec(c, { id: 'tech.http_status', category: 'technical', label: 'HTTP status', status: fetch.status < 400 ? 'pass' : 'fail', detail: String(fetch.status) })

  const isHttps = fetch.finalUrl.startsWith('https://')
  if (!isHttps) {
    add(c, { id: 'tech.https', category: 'technical', severity: 'critical', title: 'Site is not served over HTTPS', evidence: `Final URL: ${fetch.finalUrl}`, explanation: 'Browsers mark HTTP pages as "Not secure", and HTTPS is a ranking signal. Form data is sent unencrypted.', recommendation: 'Install a TLS certificate and redirect all HTTP traffic to HTTPS with a 301 redirect.', source: 'headers' })
  } else if (https.httpRedirectsToHttps === false) {
    add(c, { id: 'tech.https_redirect', category: 'technical', severity: 'medium', title: 'HTTP version does not redirect to HTTPS', evidence: https.detail, explanation: 'Visitors and crawlers that reach the http:// address are not moved to the secure version, which can split ranking signals and expose users to insecure pages.', recommendation: 'Add a permanent (301) redirect from every http:// URL to its https:// equivalent.', source: 'headers' })
  }
  rec(c, { id: 'tech.https', category: 'technical', label: 'HTTPS', status: isHttps ? (https.httpRedirectsToHttps === false ? 'warn' : 'pass') : 'fail', detail: isHttps ? https.detail : 'Not using HTTPS' })

  if (page.mixedContent.length) {
    add(c, { id: 'tech.mixed_content', category: 'technical', severity: 'medium', title: `${plural(page.mixedContent.length, 'resource')} loaded over insecure HTTP`, evidence: list(page.mixedContent, 3), explanation: 'Browsers block or warn about insecure resources on secure pages, which can break images, scripts or styles.', recommendation: 'Serve every resource over HTTPS or use protocol-relative/HTTPS URLs.', source: 'html' })
  }

  if (fetch.redirects.length > 2) {
    add(c, { id: 'tech.redirect_chain', category: 'technical', severity: 'low', title: `Redirect chain of ${fetch.redirects.length} hops`, evidence: fetch.redirects.map((r) => `${r.status} ${r.url}`).join(' → '), explanation: 'Each redirect adds latency and can dilute link signals.', recommendation: 'Link directly to the final URL and collapse redirects into a single hop.', source: 'headers' })
  }

  // Title
  const title = page.title
  if (!title) {
    add(c, { id: 'tech.title_missing', category: 'technical', severity: 'high', title: 'Page title is missing', evidence: 'No <title> element was found.', explanation: 'The title is the main headline shown in search results and browser tabs.', recommendation: 'Add a unique, descriptive <title> of roughly 30–60 characters that includes the primary topic.', source: 'html' })
    rec(c, { id: 'tech.title', category: 'technical', label: 'Page title', status: 'fail', detail: 'Missing' })
  } else {
    const len = title.length
    if (len < 15) add(c, { id: 'tech.title_short', category: 'technical', severity: 'medium', title: 'Page title is very short', evidence: `"${title}" (${len} characters)`, explanation: 'Short titles miss the opportunity to describe the page and match search queries.', recommendation: 'Expand the title to about 30–60 characters describing the page and brand.', source: 'html' })
    else if (len > 65) add(c, { id: 'tech.title_long', category: 'technical', severity: 'low', title: 'Page title may be truncated in search results', evidence: `${len} characters: "${title.slice(0, 90)}${len > 90 ? '…' : ''}"`, explanation: 'Search engines typically truncate titles beyond roughly 60 characters.', recommendation: 'Shorten the title to about 60 characters, keeping the most important words first.', source: 'html' })
    rec(c, { id: 'tech.title', category: 'technical', label: 'Page title', status: len < 15 || len > 65 ? 'warn' : 'pass', detail: `${len} characters` })
  }

  // Canonical
  if (!page.canonical) {
    add(c, { id: 'tech.canonical_missing', category: 'technical', severity: 'low', title: 'No canonical URL declared', evidence: 'No <link rel="canonical"> element was found.', explanation: 'A canonical tag tells search engines which URL is the preferred version when the same content is reachable at several addresses.', recommendation: 'Add a self-referencing canonical tag with the absolute preferred URL.', source: 'html' })
    rec(c, { id: 'tech.canonical', category: 'technical', label: 'Canonical URL', status: 'warn', detail: 'Missing' })
  } else {
    const can = new URL(page.canonical)
    const fin = new URL(fetch.finalUrl)
    const crossHost = can.hostname.replace(/^www\./, '') !== fin.hostname.replace(/^www\./, '')
    if (crossHost) {
      add(c, { id: 'tech.canonical_cross_domain', category: 'technical', severity: 'high', title: 'Canonical URL points to a different domain', evidence: `Canonical: ${page.canonical} — page: ${fetch.finalUrl}`, explanation: 'Search engines may index the other domain instead of this page.', recommendation: 'Make sure the canonical URL points to this site, unless the content is intentionally syndicated.', source: 'html' })
    }
    rec(c, { id: 'tech.canonical', category: 'technical', label: 'Canonical URL', status: crossHost ? 'fail' : 'pass', detail: page.canonical })
  }

  // Robots directives
  const robotsDirectives = `${page.robotsMeta ?? ''} ${fetch.xRobotsTag ?? ''}`.toLowerCase()
  const noindex = /\bnoindex\b|\bnone\b/.test(robotsDirectives)
  if (noindex) {
    add(c, { id: 'tech.noindex', category: 'technical', severity: 'critical', title: 'Page is blocked from search indexing (noindex)', evidence: [page.robotsMeta ? `meta robots="${page.robotsMeta}"` : null, fetch.xRobotsTag ? `X-Robots-Tag: ${fetch.xRobotsTag}` : null].filter(Boolean).join('; '), explanation: 'A noindex directive instructs search engines not to show this page in results at all.', recommendation: 'Remove the noindex directive if this page should appear in search results.', source: 'html' })
  } else if (/\bnofollow\b/.test(robotsDirectives)) {
    add(c, { id: 'tech.nofollow', category: 'technical', severity: 'medium', title: 'Page-level nofollow directive', evidence: page.robotsMeta ?? fetch.xRobotsTag ?? '', explanation: 'Search engines will not follow any links on this page, limiting discovery of other pages.', recommendation: 'Remove page-level nofollow unless it is intentional.', source: 'html' })
  }
  rec(c, { id: 'tech.robots_directives', category: 'technical', label: 'Robots directives', status: noindex ? 'fail' : 'pass', detail: robotsDirectives.trim() || 'None (indexable)' })

  // robots.txt
  if (!robots.found) {
    add(c, { id: 'tech.robots_txt_missing', category: 'technical', severity: 'low', title: 'robots.txt not found', evidence: robots.error ?? `GET /robots.txt returned ${robots.status ?? 'no response'}`, explanation: 'robots.txt guides crawlers and is the standard place to list your sitemap.', recommendation: 'Publish a robots.txt file at the site root that references your XML sitemap.', source: 'robots' })
  } else if (robots.disallowAll) {
    add(c, { id: 'tech.robots_txt_blocks_all', category: 'technical', severity: 'critical', title: 'robots.txt blocks all crawlers', evidence: 'User-agent: * is followed by Disallow: /', explanation: 'Search engines are instructed not to crawl any page of the site.', recommendation: 'Remove "Disallow: /" for User-agent: * unless the site is intentionally private.', source: 'robots' })
  }
  rec(c, { id: 'tech.robots_txt', category: 'technical', label: 'robots.txt', status: !robots.found ? 'warn' : robots.disallowAll ? 'fail' : 'pass', detail: robots.found ? `Found${robots.sitemaps.length ? `, lists ${plural(robots.sitemaps.length, 'sitemap')}` : ''}` : 'Not found' })

  // Sitemap
  if (!sitemap.found) {
    add(c, { id: 'tech.sitemap_missing', category: 'technical', severity: 'medium', title: 'XML sitemap not found', evidence: sitemap.error ?? 'No sitemap was found in robots.txt or at /sitemap.xml or /sitemap_index.xml.', explanation: 'A sitemap helps search engines discover and prioritize all important pages.', recommendation: 'Generate an XML sitemap, publish it, reference it in robots.txt and submit it in Google Search Console.', source: 'sitemap' })
  }
  rec(c, { id: 'tech.sitemap', category: 'technical', label: 'XML sitemap', status: sitemap.found ? 'pass' : 'fail', detail: sitemap.found ? `${sitemap.url}${sitemap.urlCount !== null ? ` (${sitemap.urlCount} ${sitemap.isIndex ? 'child sitemaps' : 'URLs'})` : ''}` : 'Not found' })

  // H1
  const h1s = page.headings.filter((h) => h.level === 1)
  if (h1s.length === 0) {
    add(c, { id: 'tech.h1_missing', category: 'technical', severity: 'high', title: 'No H1 heading', evidence: 'The page has no <h1> element in its HTML.', explanation: 'The H1 is the main on-page heading that tells visitors and search engines what the page is about.', recommendation: 'Add one descriptive H1 that states the main topic of the page.', source: 'html' })
  } else if (h1s.length > 1) {
    add(c, { id: 'tech.h1_multiple', category: 'technical', severity: 'low', title: `${h1s.length} H1 headings`, evidence: list(h1s.map((h) => `"${h.text.slice(0, 60)}"`), 3), explanation: 'Several H1s can dilute the primary topic of the page.', recommendation: 'Keep one H1 for the main topic and use H2–H3 for sections.', source: 'html' })
  }
  rec(c, { id: 'tech.h1', category: 'technical', label: 'H1 heading', status: h1s.length === 1 ? 'pass' : h1s.length === 0 ? 'fail' : 'warn', detail: plural(h1s.length, 'H1') })

  // Broken links
  if (links.broken.length) {
    add(c, { id: 'tech.broken_links', category: 'technical', severity: links.broken.length >= 3 ? 'high' : 'medium', title: `${plural(links.broken.length, 'broken internal link')}`, evidence: links.broken.slice(0, 5).map((b) => `${b.url} (${b.status})`).join('; '), explanation: 'Broken links frustrate visitors and waste crawl budget.', recommendation: 'Update or remove the broken links, or redirect the missing pages to relevant content.', source: 'links' })
  }
  rec(c, { id: 'tech.links', category: 'technical', label: 'Internal links (sample)', status: links.checked === 0 ? 'not_measured' : links.broken.length ? 'fail' : 'pass', detail: links.checked ? `${links.checked} checked, ${links.broken.length} broken` : 'No internal links to check' })

  // Structured data
  if (page.structuredData.invalid > 0) {
    add(c, { id: 'tech.structured_data_invalid', category: 'technical', severity: 'medium', title: 'Invalid structured data (JSON-LD)', evidence: `${plural(page.structuredData.invalid, 'JSON-LD block')} could not be parsed as JSON.`, explanation: 'Search engines ignore structured data they cannot parse, so rich results are lost.', recommendation: 'Fix the JSON syntax and validate with the Rich Results Test.', source: 'html' })
  } else if (page.structuredData.count === 0) {
    add(c, { id: 'tech.structured_data_missing', category: 'technical', severity: 'info', title: 'No structured data found', evidence: 'No JSON-LD blocks in the static HTML.', explanation: 'Structured data (Schema.org) can make the page eligible for rich results such as business details or FAQs.', recommendation: 'Add relevant JSON-LD, e.g. Organization or LocalBusiness on the homepage.', source: 'html' })
  }
  rec(c, { id: 'tech.structured_data', category: 'technical', label: 'Structured data', status: page.structuredData.invalid ? 'fail' : page.structuredData.count ? 'pass' : 'info', detail: page.structuredData.count ? page.structuredData.types.join(', ') || `${page.structuredData.count} block(s)` : 'None' })
}

function content(c: Ctx) {
  const { page, readability } = c.f
  const desc = page.metaDescription
  if (!desc) {
    add(c, { id: 'content.meta_description_missing', category: 'content', severity: 'medium', title: 'Meta description is missing', evidence: 'No <meta name="description"> was found.', explanation: 'Search engines often use the meta description as the snippet under your title; without it they pick arbitrary page text.', recommendation: 'Write a compelling 120–160 character description summarizing the page and its value.', source: 'html' })
    rec(c, { id: 'content.meta_description', category: 'content', label: 'Meta description', status: 'fail', detail: 'Missing' })
  } else {
    const len = desc.length
    if (len < 50) add(c, { id: 'content.meta_description_short', category: 'content', severity: 'low', title: 'Meta description is short', evidence: `${len} characters: "${desc}"`, explanation: 'A short description gives searchers little reason to click.', recommendation: 'Expand to roughly 120–160 characters.', source: 'html' })
    else if (len > 165) add(c, { id: 'content.meta_description_long', category: 'content', severity: 'low', title: 'Meta description may be truncated', evidence: `${len} characters`, explanation: 'Descriptions over about 160 characters are usually cut off in results.', recommendation: 'Trim the description to about 160 characters.', source: 'html' })
    rec(c, { id: 'content.meta_description', category: 'content', label: 'Meta description', status: len < 50 || len > 165 ? 'warn' : 'pass', detail: `${len} characters` })
  }

  if (page.wordCount < 250) {
    add(c, { id: 'content.thin', category: 'content', severity: page.wordCount < 100 ? 'high' : 'medium', title: 'Limited text content in the HTML', evidence: `${page.wordCount} words found in the static HTML.`, explanation: 'Pages with little indexable text give search engines and visitors less to understand. Content rendered only by JavaScript is not visible in this static check.', recommendation: 'Add substantive, useful copy that answers what visitors are looking for, and make sure key content is present in the server-rendered HTML.', source: 'html' })
  }
  rec(c, { id: 'content.word_count', category: 'content', label: 'Text content', status: page.wordCount < 250 ? 'warn' : 'pass', detail: `${page.wordCount} words` })

  const emptyHeadings = page.headings.filter((h) => !h.text)
  if (emptyHeadings.length) add(c, { id: 'content.empty_headings', category: 'content', severity: 'low', title: `${plural(emptyHeadings.length, 'empty heading')}`, evidence: emptyHeadings.map((h) => `H${h.level}`).join(', '), explanation: 'Empty headings add no meaning and confuse screen-reader navigation.', recommendation: 'Remove empty heading elements or give them descriptive text.', source: 'html' })
  const longHeadings = page.headings.filter((h) => h.text.length > 120)
  if (longHeadings.length) add(c, { id: 'content.long_headings', category: 'content', severity: 'low', title: 'Headings used for long text', evidence: `${plural(longHeadings.length, 'heading')} longer than 120 characters`, explanation: 'Headings should be short labels for sections, not paragraphs.', recommendation: 'Shorten headings and move long text into paragraphs.', source: 'html' })
  const h2 = page.headings.filter((h) => h.level === 2).length
  if (page.wordCount > 600 && h2 === 0) add(c, { id: 'content.structure', category: 'content', severity: 'low', title: 'Long content without section headings', evidence: `${page.wordCount} words and no H2 headings.`, explanation: 'Subheadings make long content scannable for visitors and help search engines understand topics.', recommendation: 'Break the content into sections with descriptive H2 headings.', source: 'html' })
  rec(c, { id: 'content.headings', category: 'content', label: 'Heading quality', status: emptyHeadings.length || longHeadings.length ? 'warn' : 'pass', detail: `${page.headings.length} headings, ${h2} H2` })

  const realImages = page.images.filter((i) => !i.decorative)
  const generic = realImages.filter((i) => i.alt && GENERIC_ALT.test(i.alt))
  if (generic.length) add(c, { id: 'content.alt_quality', category: 'content', severity: 'low', title: `${plural(generic.length, 'image')} with non-descriptive alt text`, evidence: list(generic.map((g) => `"${g.alt}"`), 4), explanation: 'Alt text such as filenames or "image" does not describe the image for search engines or screen-reader users.', recommendation: 'Describe what each meaningful image shows in a short phrase.', source: 'html' })

  if (readability.applicable && readability.fleschReadingEase !== null) {
    if (readability.fleschReadingEase < 30) {
      add(c, { id: 'content.readability', category: 'content', severity: 'low', estimate: true, title: 'Copy is difficult to read (estimate)', evidence: `Flesch reading ease ≈ ${readability.fleschReadingEase}; average sentence length ≈ ${readability.avgSentenceLength} words.`, explanation: 'Dense copy with long sentences and words is harder for most visitors to scan. This is an automated English-language estimate.', recommendation: 'Use shorter sentences, plain words and bullet points for key information.', source: 'html' })
    }
    rec(c, { id: 'content.readability', category: 'content', label: 'Readability (estimate)', status: readability.fleschReadingEase < 30 ? 'warn' : 'pass', detail: `Flesch ≈ ${readability.fleschReadingEase}` })
  } else {
    rec(c, { id: 'content.readability', category: 'content', label: 'Readability (estimate)', status: 'not_measured', detail: readability.applicable ? 'Not enough text to estimate' : 'Only estimated for English pages' })
  }
}

function performance(c: Ctx) {
  const { fetch, page, images, pagespeed } = c.f
  if (fetch.htmlBytes > 1_000_000 || fetch.truncated) {
    add(c, { id: 'perf.html_size', category: 'performance', severity: 'high', title: 'Very large HTML document', evidence: `${formatBytesPlain(fetch.htmlBytes)} of HTML${fetch.truncated ? ' (download capped by the auditor)' : ''}.`, explanation: 'Large documents take longer to download and parse, especially on mobile.', recommendation: 'Reduce inline scripts/styles and embedded data; paginate or lazy-load long content.', source: 'headers' })
  } else if (fetch.htmlBytes > 400_000) {
    add(c, { id: 'perf.html_size', category: 'performance', severity: 'medium', title: 'Large HTML document', evidence: `${formatBytesPlain(fetch.htmlBytes)} of HTML.`, explanation: 'HTML over ~400 KB slows the first render on slower connections.', recommendation: 'Move large inline scripts, styles and JSON payloads into cached external files.', source: 'headers' })
  }
  rec(c, { id: 'perf.html_size', category: 'performance', label: 'HTML size', status: fetch.htmlBytes > 400_000 ? 'warn' : 'pass', detail: `${formatBytesPlain(fetch.htmlBytes)} decoded, ${formatBytesPlain(fetch.transferBytes)} transferred` })

  if (!fetch.contentEncoding && fetch.htmlBytes > 20_000) {
    add(c, { id: 'perf.compression', category: 'performance', severity: 'medium', title: 'HTML is not compressed', evidence: `No Content-Encoding header on a ${formatBytesPlain(fetch.htmlBytes)} response.`, explanation: 'Gzip or Brotli typically reduces HTML transfer size by 60–80%.', recommendation: 'Enable Brotli or gzip compression on the web server or CDN.', source: 'headers' })
  }
  rec(c, { id: 'perf.compression', category: 'performance', label: 'Compression', status: fetch.contentEncoding ? 'pass' : fetch.htmlBytes > 20_000 ? 'fail' : 'info', detail: fetch.contentEncoding ?? 'None' })

  if (fetch.ttfbMs > 1800) add(c, { id: 'perf.ttfb', category: 'performance', severity: 'medium', estimate: true, title: 'Slow server response (single sample)', evidence: `≈ ${fetch.ttfbMs} ms to first response byte, measured once from the audit server.`, explanation: 'A slow initial response delays everything else. Network distance affects this single measurement, so treat it as indicative.', recommendation: 'Investigate server caching, hosting performance and a CDN for HTML.', source: 'headers' })
  rec(c, { id: 'perf.ttfb', category: 'performance', label: 'Server response (estimate)', status: fetch.ttfbMs > 1800 ? 'warn' : 'pass', detail: `≈ ${fetch.ttfbMs} ms (single sample)` })

  const extScripts = page.scripts.filter((s) => s.src)
  const blockingScripts = page.scripts.filter((s) => s.src && s.inHead && !s.async && !s.defer && !s.module)
  const blockingStyles = page.stylesheets.filter((s) => s.inHead && (!s.media || s.media === 'all' || s.media === 'screen'))
  if (blockingScripts.length >= 1) {
    add(c, { id: 'perf.render_blocking_scripts', category: 'performance', severity: blockingScripts.length >= 4 ? 'medium' : 'low', title: `${plural(blockingScripts.length, 'render-blocking script')} in <head>`, evidence: list(blockingScripts.map((s) => s.src!.replace(/^https?:\/\//, '')), 3), explanation: 'Synchronous scripts in the head stop the browser from rendering until they download and execute.', recommendation: 'Add defer or async to non-critical scripts, or move them to the end of the body.', source: 'assets' })
  }
  if (blockingStyles.length > 4) {
    add(c, { id: 'perf.render_blocking_styles', category: 'performance', severity: 'low', title: `${blockingStyles.length} stylesheets block rendering`, evidence: list(blockingStyles.map((s) => s.href.replace(/^https?:\/\//, '')), 3), explanation: 'Each stylesheet in the head must load before the page is painted.', recommendation: 'Combine stylesheets, inline critical CSS and load the rest asynchronously.', source: 'assets' })
  }
  rec(c, { id: 'perf.render_blocking', category: 'performance', label: 'Render-blocking resources', status: blockingScripts.length || blockingStyles.length > 4 ? 'warn' : 'pass', detail: `${blockingScripts.length} scripts, ${blockingStyles.length} stylesheets in <head>` })

  const assetCount = extScripts.length + page.stylesheets.length + page.images.length + page.iframes
  if (assetCount > 120 || extScripts.length > 35) {
    add(c, { id: 'perf.asset_count', category: 'performance', severity: 'medium', title: 'High number of page resources', evidence: `${extScripts.length} external scripts, ${page.stylesheets.length} stylesheets, ${page.images.length} images, ${page.iframes} iframes referenced in the HTML.`, explanation: 'Every resource adds requests and work for the browser, particularly third-party scripts.', recommendation: 'Remove unused scripts and tags, bundle assets and lazy-load below-the-fold content.', source: 'assets' })
  }
  rec(c, { id: 'perf.asset_count', category: 'performance', label: 'Referenced resources', status: assetCount > 120 || extScripts.length > 35 ? 'warn' : 'pass', detail: `${assetCount} referenced in HTML` })

  const heavy = images.sampled.filter((i) => (i.bytes ?? 0) > 300_000)
  if (heavy.length) add(c, { id: 'perf.images_heavy', category: 'performance', severity: heavy.length >= 3 ? 'high' : 'medium', title: `${plural(heavy.length, 'large image')} over 300 KB`, evidence: heavy.slice(0, 4).map((h) => `${h.src.split('/').pop()?.slice(0, 60)} (${formatBytesPlain(h.bytes ?? 0)})`).join('; '), explanation: 'Oversized images are the most common cause of slow page loads.', recommendation: 'Resize images to their displayed size and compress them; serve WebP or AVIF.', source: 'assets' })
  const legacy = images.sampled.filter((i) => i.type && /jpe?g|png|gif|bmp/.test(i.type) && (i.bytes ?? 0) > 100_000)
  if (legacy.length) add(c, { id: 'perf.images_format', category: 'performance', severity: 'low', title: 'Images could use modern formats', evidence: `${plural(legacy.length, 'sampled image')} over 100 KB served as JPEG/PNG/GIF.`, explanation: 'WebP and AVIF are typically 25–50% smaller at similar quality.', recommendation: 'Serve WebP/AVIF with fallbacks via <picture> or an image CDN.', source: 'assets' })
  rec(c, { id: 'perf.images', category: 'performance', label: 'Image weight (sample)', status: images.sampled.length === 0 ? 'not_measured' : heavy.length ? 'fail' : 'pass', detail: images.sampled.length ? `${images.sampled.length} images sampled` : 'No images sampled' })

  const noDims = page.images.filter((i) => i.src !== 'data:' && (!i.width || !i.height))
  if (page.images.length >= 3 && noDims.length / page.images.length > 0.5) add(c, { id: 'perf.image_dimensions', category: 'performance', severity: 'low', title: 'Images without width and height', evidence: `${noDims.length} of ${page.images.length} images have no width/height attributes.`, explanation: 'Without dimensions the browser cannot reserve space, which causes layout shifts (CLS).', recommendation: 'Set width and height attributes (or CSS aspect-ratio) on images.', source: 'html' })
  const lazy = page.images.filter((i) => i.loading === 'lazy').length
  if (page.images.length > 8 && lazy === 0) add(c, { id: 'perf.lazy_loading', category: 'performance', severity: 'low', title: 'Images are not lazy-loaded', evidence: `${page.images.length} images, none with loading="lazy".`, explanation: 'Loading off-screen images upfront wastes bandwidth and delays visible content.', recommendation: 'Add loading="lazy" to images below the fold.', source: 'html' })

  // PageSpeed Insights — real data only.
  if (pagespeed) {
    const { lab, field } = pagespeed
    if (lab.performanceScore !== null) {
      if (lab.performanceScore < 50) add(c, { id: 'perf.psi_score', category: 'performance', severity: 'high', title: `Lighthouse mobile performance score ${lab.performanceScore}`, evidence: `PageSpeed Insights lab test (mobile): score ${lab.performanceScore}/100${lab.lcpMs ? `, LCP ${(lab.lcpMs / 1000).toFixed(1)} s` : ''}${lab.tbtMs !== null ? `, TBT ${Math.round(lab.tbtMs)} ms` : ''}.`, explanation: 'A low lab score indicates slow loading and responsiveness on a typical mobile device.', recommendation: 'Address the largest contributors: image weight, render-blocking resources and heavy JavaScript.', source: 'pagespeed' })
      else if (lab.performanceScore < 90) add(c, { id: 'perf.psi_score', category: 'performance', severity: 'medium', title: `Lighthouse mobile performance score ${lab.performanceScore}`, evidence: `PageSpeed Insights lab test (mobile): ${lab.performanceScore}/100.`, explanation: 'There is room to improve loading performance on mobile devices.', recommendation: 'Review the PageSpeed Insights opportunities for this URL.', source: 'pagespeed' })
      rec(c, { id: 'perf.psi', category: 'performance', label: 'PageSpeed Insights (lab, mobile)', status: lab.performanceScore >= 90 ? 'pass' : lab.performanceScore >= 50 ? 'warn' : 'fail', detail: `${lab.performanceScore}/100` })
    }
    if (field.available) {
      if (field.lcpMs !== null && field.lcpMs > 2500) add(c, { id: 'perf.cwv_lcp', category: 'performance', severity: field.lcpMs > 4000 ? 'high' : 'medium', title: 'Largest Contentful Paint needs improvement (real users)', evidence: `Chrome UX Report p75 LCP: ${(field.lcpMs / 1000).toFixed(2)} s (good ≤ 2.5 s).`, explanation: 'Real visitors wait too long for the main content to appear.', recommendation: 'Optimize the largest above-the-fold element (often a hero image) and server response time.', source: 'pagespeed' })
      if (field.inpMs !== null && field.inpMs > 200) add(c, { id: 'perf.cwv_inp', category: 'performance', severity: field.inpMs > 500 ? 'high' : 'medium', title: 'Interaction to Next Paint needs improvement (real users)', evidence: `Chrome UX Report p75 INP: ${Math.round(field.inpMs)} ms (good ≤ 200 ms).`, explanation: 'The page responds slowly to clicks and taps for real visitors.', recommendation: 'Reduce long JavaScript tasks and third-party script work.', source: 'pagespeed' })
      if (field.cls !== null && field.cls > 0.1) add(c, { id: 'perf.cwv_cls', category: 'performance', severity: field.cls > 0.25 ? 'high' : 'medium', title: 'Layout shifts affect real users', evidence: `Chrome UX Report p75 CLS: ${field.cls.toFixed(2)} (good ≤ 0.1).`, explanation: 'Content moves while loading, which leads to mis-clicks and frustration.', recommendation: 'Reserve space for images, ads and embeds; avoid inserting content above existing content.', source: 'pagespeed' })
      rec(c, { id: 'perf.cwv', category: 'performance', label: 'Core Web Vitals (field data)', status: field.overall === 'FAST' ? 'pass' : 'warn', detail: [field.lcpMs !== null ? `LCP ${(field.lcpMs / 1000).toFixed(2)}s` : null, field.inpMs !== null ? `INP ${Math.round(field.inpMs)}ms` : null, field.cls !== null ? `CLS ${field.cls.toFixed(2)}` : null].filter(Boolean).join(', ') || 'Available' })
    } else {
      rec(c, { id: 'perf.cwv', category: 'performance', label: 'Core Web Vitals (field data)', status: 'not_measured', detail: 'Google has no Chrome UX Report data for this URL' })
    }
  } else {
    rec(c, { id: 'perf.cwv', category: 'performance', label: 'Core Web Vitals', status: 'not_measured', detail: c.f.pagespeedStatus === 'failed' ? 'PageSpeed Insights request failed' : 'PageSpeed Insights not configured' })
  }
}

function accessibility(c: Ctx) {
  const { page } = c.f
  const meaningful = page.images.filter((i) => !i.decorative)
  const missingAlt = meaningful.filter((i) => i.alt === null)
  if (missingAlt.length) {
    add(c, { id: 'a11y.img_alt', category: 'accessibility', severity: missingAlt.length / Math.max(1, meaningful.length) > 0.3 ? 'high' : 'medium', title: `${plural(missingAlt.length, 'image')} without an alt attribute`, evidence: `${missingAlt.length} of ${meaningful.length} images: ${list(missingAlt.map((i) => i.src.split('/').pop()?.slice(0, 50) ?? i.src), 3)}`, explanation: 'Screen readers cannot describe images without alt text, and search engines lose context. Decorative images should use alt="".', recommendation: 'Add descriptive alt text to meaningful images and alt="" to purely decorative ones.', source: 'html' })
  }
  rec(c, { id: 'a11y.img_alt', category: 'accessibility', label: 'Image alt attributes', status: missingAlt.length ? 'fail' : 'pass', detail: `${meaningful.length - missingAlt.length}/${meaningful.length} images have alt` })

  const unlabeled = page.forms.inputs.filter((i) => !i.labelled)
  if (unlabeled.length) add(c, { id: 'a11y.form_labels', category: 'accessibility', severity: 'high', title: `${plural(unlabeled.length, 'form field')} without an accessible label`, evidence: list(unlabeled.map((i) => `${i.type}${i.name ? ` "${i.name}"` : ''}`), 4), explanation: 'Fields without labels are announced as unnamed controls by screen readers. Placeholder text is not a substitute for a label.', recommendation: 'Associate a visible <label for> with each field, or add aria-label where a visible label is not possible.', source: 'html' })
  rec(c, { id: 'a11y.form_labels', category: 'accessibility', label: 'Form labels', status: page.forms.inputs.length === 0 ? 'info' : unlabeled.length ? 'fail' : 'pass', detail: page.forms.inputs.length ? `${page.forms.inputs.length - unlabeled.length}/${page.forms.inputs.length} fields labelled` : 'No form fields' })

  const skips: string[] = []
  for (let i = 1; i < page.headings.length; i++) {
    const prev = page.headings[i - 1].level
    const cur = page.headings[i].level
    if (cur > prev + 1) skips.push(`H${prev} → H${cur}`)
  }
  if (skips.length) add(c, { id: 'a11y.heading_order', category: 'accessibility', severity: 'low', title: 'Heading levels are skipped', evidence: list([...new Set(skips)], 4), explanation: 'Screen-reader users navigate by headings; skipped levels make the structure harder to follow.', recommendation: 'Use heading levels in order (H1, then H2, then H3) to reflect the content outline.', source: 'html' })
  rec(c, { id: 'a11y.heading_order', category: 'accessibility', label: 'Heading hierarchy', status: skips.length ? 'warn' : 'pass', detail: skips.length ? `${skips.length} skipped levels` : 'Sequential' })

  if (!page.lang) add(c, { id: 'a11y.lang', category: 'accessibility', severity: 'medium', title: 'Page language is not declared', evidence: '<html> has no lang attribute.', explanation: 'Screen readers use the lang attribute to choose the correct pronunciation.', recommendation: 'Add lang="en" (or the correct language code) to the <html> element.', source: 'html' })
  rec(c, { id: 'a11y.lang', category: 'accessibility', label: 'Language attribute', status: page.lang ? 'pass' : 'fail', detail: page.lang ?? 'Missing' })

  if (!page.landmarks.main) add(c, { id: 'a11y.landmark_main', category: 'accessibility', severity: 'low', title: 'No <main> landmark', evidence: 'No <main> element or role="main" was found.', explanation: 'Landmarks let keyboard and screen-reader users jump straight to the main content.', recommendation: 'Wrap the primary content in a <main> element.', source: 'html' })
  rec(c, { id: 'a11y.landmarks', category: 'accessibility', label: 'Semantic landmarks', status: page.landmarks.main ? 'pass' : 'warn', detail: Object.entries(page.landmarks).filter(([, v]) => v).map(([k]) => k).join(', ') || 'None' })

  const namelessLinks = page.links.filter((l) => !l.accessibleName)
  const namelessButtons = page.buttons.filter((b) => !b.hasName)
  if (namelessLinks.length + namelessButtons.length > 0) add(c, { id: 'a11y.control_names', category: 'accessibility', severity: 'medium', title: 'Links or buttons without an accessible name', evidence: `${plural(namelessLinks.length, 'link')} and ${plural(namelessButtons.length, 'button')} have no text, aria-label or labelled image.`, explanation: 'Icon-only controls are announced as "link" or "button" with no purpose.', recommendation: 'Add visible text or an aria-label describing each control’s action.', source: 'html' })
  rec(c, { id: 'a11y.control_names', category: 'accessibility', label: 'Link & button names', status: namelessLinks.length + namelessButtons.length ? 'fail' : 'pass', detail: `${namelessLinks.length + namelessButtons.length} unnamed controls` })

  const vp = (page.viewport ?? '').toLowerCase()
  const maxScale = Number(vp.match(/maximum-scale\s*=\s*([\d.]+)/)?.[1] ?? 'NaN')
  if (/user-scalable\s*=\s*(no|0)/.test(vp) || (!Number.isNaN(maxScale) && maxScale < 2)) add(c, { id: 'a11y.zoom_disabled', category: 'accessibility', severity: 'medium', title: 'Zooming is restricted on mobile', evidence: `viewport="${page.viewport}"`, explanation: 'Preventing pinch-zoom makes text unreadable for people with low vision.', recommendation: 'Remove user-scalable=no and any maximum-scale below 2 from the viewport meta tag.', source: 'html' })

  rec(c, { id: 'a11y.contrast', category: 'accessibility', label: 'Color contrast', status: 'not_measured', detail: 'Requires rendering the page with computed styles; not measured by the static audit' })
}

function conversion(c: Ctx) {
  const { page } = c.f
  if (!page.viewport) add(c, { id: 'ux.viewport', category: 'conversion', severity: 'high', title: 'No mobile viewport configuration', evidence: 'No <meta name="viewport"> tag.', explanation: 'Without a viewport tag, mobile browsers render the desktop layout zoomed out, which is hard to use.', recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', source: 'html' })
  rec(c, { id: 'ux.viewport', category: 'conversion', label: 'Mobile viewport', status: page.viewport ? 'pass' : 'fail', detail: page.viewport ?? 'Missing' })

  const tel = page.links.filter((l) => /^tel:/i.test(l.href)).length
  const mail = page.links.filter((l) => /^mailto:/i.test(l.href)).length
  const contactLinks = page.links.filter((l) => /contact|kontakt|contacto|get-in-touch/i.test(l.href) || /contact|get in touch/i.test(l.text)).length
  const contactForm = page.forms.count > 0 && (page.forms.hasEmailField || page.forms.hasTextarea)
  const contactSignals = tel + mail + contactLinks + (contactForm ? 1 : 0)
  if (contactSignals === 0) add(c, { id: 'ux.contact', category: 'conversion', severity: 'high', title: 'No visible contact options', evidence: 'No phone links, email links, contact page links or contact forms were found.', explanation: 'Visitors who are ready to act need an obvious way to get in touch.', recommendation: 'Add a clear contact link in the header, plus a click-to-call phone number or contact form.', source: 'html' })
  else if (tel === 0 && contactLinks === 0 && !contactForm) add(c, { id: 'ux.contact_limited', category: 'conversion', severity: 'low', title: 'Limited contact options', evidence: `Only ${plural(mail, 'email link')} found.`, explanation: 'Some visitors prefer calling or a form over email.', recommendation: 'Consider adding a contact form or click-to-call phone number.', source: 'html' })
  rec(c, { id: 'ux.contact', category: 'conversion', label: 'Contact options', status: contactSignals ? 'pass' : 'fail', detail: `${tel} phone, ${mail} email, ${contactLinks} contact links, ${contactForm ? 'contact form' : 'no form'}` })

  const ctaTexts = [...page.links.map((l) => l.text), ...page.buttons.map((b) => b.text)].filter((t) => t && t.length < 60 && CTA_PATTERN.test(t))
  if (ctaTexts.length === 0) add(c, { id: 'ux.cta', category: 'conversion', severity: 'medium', title: 'No clear call to action', evidence: 'No links or buttons with action wording (e.g. "Get a quote", "Book a call", "Contact us") were found.', explanation: 'A clear next step guides visitors toward converting.', recommendation: 'Add a prominent primary call to action above the fold and repeat it after key sections.', source: 'html' })
  rec(c, { id: 'ux.cta', category: 'conversion', label: 'Calls to action', status: ctaTexts.length ? 'pass' : 'fail', detail: ctaTexts.length ? list([...new Set(ctaTexts)].map((t) => `"${t}"`), 3) : 'None detected' })

  const navLinks = page.links.filter((l) => l.inNav && l.internal).length
  if (!page.landmarks.nav && navLinks < 2) add(c, { id: 'ux.navigation', category: 'conversion', severity: 'medium', title: 'No clear navigation menu', evidence: 'No <nav> element and fewer than 2 internal links in the header.', explanation: 'Visitors need predictable navigation to find services, pricing and contact information.', recommendation: 'Add a primary navigation menu with links to the key pages.', source: 'html' })
  else if (navLinks > 60) add(c, { id: 'ux.navigation_overloaded', category: 'conversion', severity: 'low', title: 'Navigation has a very large number of links', evidence: `${navLinks} internal links in navigation/header areas.`, explanation: 'Too many choices can overwhelm visitors.', recommendation: 'Group navigation into clear categories and surface the most important pages.', source: 'html' })
  rec(c, { id: 'ux.navigation', category: 'conversion', label: 'Navigation', status: page.landmarks.nav || navLinks >= 2 ? 'pass' : 'fail', detail: `${navLinks} navigation links` })

  if (!page.hasFavicon) add(c, { id: 'ux.favicon', category: 'conversion', severity: 'low', title: 'No favicon declared', evidence: 'No <link rel="icon"> found in the HTML.', explanation: 'A favicon helps visitors recognize your tab and bookmarks and appears in mobile search results.', recommendation: 'Add a favicon and apple-touch-icon.', source: 'html' })
  if (!page.openGraph.title || !page.openGraph.image) add(c, { id: 'ux.social_preview', category: 'conversion', severity: 'low', title: 'Incomplete social sharing preview', evidence: `og:title ${page.openGraph.title ? 'present' : 'missing'}, og:image ${page.openGraph.image ? 'present' : 'missing'}.`, explanation: 'Links shared on social platforms and messaging apps look plain without Open Graph tags.', recommendation: 'Add og:title, og:description and og:image tags.', source: 'html' })
  rec(c, { id: 'ux.social_preview', category: 'conversion', label: 'Social sharing tags', status: page.openGraph.title && page.openGraph.image ? 'pass' : 'warn', detail: page.openGraph.title && page.openGraph.image ? 'Open Graph complete' : 'Incomplete' })
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const

/** Runs every rule. Pure: same findings in, same issues out. */
export function runChecks(findings: Findings): { issues: Issue[]; checks: CheckRecord[] } {
  const c: Ctx = { f: findings, issues: [], checks: [] }
  technical(c)
  content(c)
  performance(c)
  accessibility(c)
  conversion(c)
  // Keep the first issue per id (some ids can be produced by alternative branches).
  const seen = new Set<string>()
  const issues = c.issues.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return { issues, checks: c.checks }
}
