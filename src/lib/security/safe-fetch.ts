import 'server-only'
import dns from 'node:dns'
import net from 'node:net'
import zlib from 'node:zlib'
import { Agent, request } from 'undici'
import { isPublicIp, validatePublicUrl, UrlValidationError } from './url-validation'

export type SafeResponse = {
  url: string
  status: number
  headers: Record<string, string>
  body: Buffer
  transferBytes: number
  truncated: boolean
  ttfbMs: number
  redirects: { url: string; status: number }[]
}

export type SafeFetchOptions = {
  method?: 'GET' | 'HEAD'
  maxBytes?: number
  timeoutMs?: number
  maxRedirects?: number
  accept?: string
}

export type LookupFn = typeof dns.lookup

export const AUDIT_USER_AGENT = 'Mozilla/5.0 (compatible; AgencyOS-AuditBot/1.0; +https://agencyos.ai/bot)'

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void

/**
 * DNS lookup wrapper used for every outbound connection. Resolves all
 * addresses and refuses the connection if any of them is non-public. Because
 * the socket connects to the address returned here, there is no window for
 * DNS rebinding between validation and connection.
 */
export function createSafeLookup(resolver: LookupFn = dns.lookup) {
  return function safeLookup(hostname: string, options: dns.LookupOptions | number | undefined, callback: LookupCallback) {
    const opts: dns.LookupOptions = typeof options === 'number' ? { family: options } : (options ?? {})
    resolver(hostname, { ...opts, all: true, verbatim: true }, (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => {
      if (err) return callback(err, [])
      const list = Array.isArray(addresses) ? addresses : []
      if (list.length === 0) return callback(Object.assign(new Error(`No addresses for ${hostname}`), { code: 'ENOTFOUND' }), [])
      const blocked = list.find((a) => !isPublicIp(a.address))
      if (blocked) {
        return callback(Object.assign(new Error(`Blocked non-public address for ${hostname}`), { code: 'EBLOCKEDADDR' }), [])
      }
      if (opts.all) return callback(null, list)
      callback(null, list[0].address, list[0].family)
    })
  }
}

let defaultAgent: Agent | null = null
export function createSafeAgent(resolver?: LookupFn) {
  return new Agent({
    connect: { lookup: createSafeLookup(resolver) as unknown as net.LookupFunction, timeout: 8000 },
    headersTimeout: 15000,
    bodyTimeout: 15000,
    connections: 16,
    // Never pick up proxy settings: proxies resolve DNS themselves, which
    // would bypass the address checks above.
  })
}

export class SafeFetchError extends Error {
  constructor(message: string, readonly kind: 'blocked' | 'timeout' | 'network' | 'too_many_redirects' | 'invalid_url') {
    super(message)
    this.name = 'SafeFetchError'
  }
}

function decompress(buf: Buffer, encoding: string, maxBytes: number): { body: Buffer; truncated: boolean } {
  const opts = { maxOutputLength: maxBytes }
  try {
    if (encoding === 'gzip' || encoding === 'x-gzip') return { body: zlib.gunzipSync(buf, opts), truncated: false }
    if (encoding === 'br') return { body: zlib.brotliDecompressSync(buf, opts), truncated: false }
    if (encoding === 'deflate') return { body: zlib.inflateSync(buf, opts), truncated: false }
  } catch (err) {
    // Exceeding maxOutputLength (decompression bomb) or a truncated stream.
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ERR_BUFFER_TOO_LARGE') return { body: Buffer.alloc(0), truncated: true }
    try {
      // A capped body may be cut mid-stream; recover what decodes.
      if (encoding.includes('gzip')) return { body: zlib.gunzipSync(buf, { ...opts, finishFlush: zlib.constants.Z_SYNC_FLUSH }), truncated: true }
      if (encoding === 'br') return { body: zlib.brotliDecompressSync(buf, { ...opts, finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH }), truncated: true }
    } catch {
      /* fall through */
    }
    return { body: Buffer.alloc(0), truncated: true }
  }
  return { body: buf, truncated: false }
}

/**
 * SSRF-safe HTTP client for auditing third-party websites:
 *  - http/https only, standard ports, no credentials (validatePublicUrl)
 *  - every DNS answer validated at connect time (no rebinding)
 *  - redirects followed manually with full re-validation of each hop
 *  - hard timeout, response size cap, decompression-bomb guard
 *  - never executes page JavaScript (raw bytes only)
 */
export async function safeFetch(input: string, options: SafeFetchOptions = {}, agent?: Agent): Promise<SafeResponse> {
  const { method = 'GET', maxBytes = 3 * 1024 * 1024, timeoutMs = 15000, maxRedirects = 5, accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' } = options
  const dispatcher = agent ?? (defaultAgent ??= createSafeAgent())
  const signal = AbortSignal.timeout(timeoutMs)
  const redirects: { url: string; status: number }[] = []
  let current: URL
  try {
    current = validatePublicUrl(input)
  } catch (err) {
    throw new SafeFetchError(err instanceof UrlValidationError ? err.message : 'Invalid URL', 'invalid_url')
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const started = performance.now()
    let res: Awaited<ReturnType<typeof request>>
    try {
      res = await request(current, {
        method,
        dispatcher,
        signal,
        headers: { 'user-agent': AUDIT_USER_AGENT, accept, 'accept-encoding': 'gzip, deflate, br', 'accept-language': 'en;q=0.9,*;q=0.5' },
      })
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException }
      const code = e.code ?? e.cause?.code
      if (code === 'EBLOCKEDADDR') throw new SafeFetchError('The site resolves to a private or reserved network address and cannot be audited.', 'blocked')
      if (signal.aborted || e.name === 'AbortError' || code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
        throw new SafeFetchError('The website did not respond in time.', 'timeout')
      }
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') throw new SafeFetchError('The domain name could not be resolved.', 'network')
      throw new SafeFetchError('Could not connect to the website.', 'network')
    }
    const ttfbMs = Math.round(performance.now() - started)
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(res.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v ?? '')

    if (res.statusCode >= 300 && res.statusCode < 400 && headers.location) {
      await res.body.dump().catch(() => undefined)
      redirects.push({ url: current.toString(), status: res.statusCode })
      let next: URL
      try {
        next = validatePublicUrl(new URL(headers.location, current).toString())
      } catch (err) {
        throw new SafeFetchError(`Redirect blocked: ${err instanceof Error ? err.message : 'invalid target'}`, 'blocked')
      }
      current = next
      continue
    }

    const chunks: Buffer[] = []
    let received = 0
    let truncated = false
    if (method !== 'HEAD') {
      try {
        for await (const chunk of res.body) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
          if (received + buf.length > maxBytes) {
            chunks.push(buf.subarray(0, maxBytes - received))
            received = maxBytes
            truncated = true
            res.body.destroy()
            break
          }
          chunks.push(buf)
          received += buf.length
        }
      } catch (err) {
        if (!truncated) {
          if (signal.aborted) throw new SafeFetchError('The website did not finish responding in time.', 'timeout')
          throw new SafeFetchError(`Failed reading the response: ${(err as Error).message}`, 'network')
        }
      }
    } else {
      await res.body.dump().catch(() => undefined)
    }
    const raw = Buffer.concat(chunks)
    const encoding = (headers['content-encoding'] ?? '').trim().toLowerCase()
    const decoded = encoding ? decompress(raw, encoding, maxBytes) : { body: raw, truncated: false }
    return {
      url: current.toString(),
      status: res.statusCode,
      headers,
      body: decoded.body,
      transferBytes: received,
      truncated: truncated || decoded.truncated,
      ttfbMs,
      redirects,
    }
  }
  throw new SafeFetchError(`Too many redirects (more than ${maxRedirects}).`, 'too_many_redirects')
}
