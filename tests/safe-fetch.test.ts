import http from 'node:http'
import net from 'node:net'
import zlib from 'node:zlib'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Agent } from 'undici'
import { createSafeAgent, createSafeLookup, safeFetch, SafeFetchError, type LookupFn } from '@/lib/security/safe-fetch'

const fakeResolver = (map: Record<string, string[]>): LookupFn =>
  ((host: string, _opts: unknown, cb: (e: NodeJS.ErrnoException | null, a: { address: string; family: number }[]) => void) => {
    const addrs = map[host]
    if (!addrs) return cb(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }), [])
    cb(null, addrs.map((a) => ({ address: a, family: a.includes(':') ? 6 : 4 })))
  }) as unknown as LookupFn

describe('createSafeLookup (DNS rebinding protection)', () => {
  it('refuses hostnames that resolve to private addresses', async () => {
    const lookup = createSafeLookup(fakeResolver({ 'evil.agencyos-test.com': ['127.0.0.1'] }))
    const err = await new Promise<NodeJS.ErrnoException | null>((r) => lookup('evil.agencyos-test.com', { all: true }, (e) => r(e)))
    expect(err?.code).toBe('EBLOCKEDADDR')
  })
  it('refuses when any of several answers is private', async () => {
    const lookup = createSafeLookup(fakeResolver({ 'mixed.agencyos-test.com': ['8.8.8.8', '10.0.0.5'] }))
    const err = await new Promise<NodeJS.ErrnoException | null>((r) => lookup('mixed.agencyos-test.com', { all: true }, (e) => r(e)))
    expect(err?.code).toBe('EBLOCKEDADDR')
  })
  it('passes public answers through', async () => {
    const lookup = createSafeLookup(fakeResolver({ 'ok.agencyos-test.com': ['8.8.8.8'] }))
    const res = await new Promise<unknown>((r) => lookup('ok.agencyos-test.com', {}, (_e, a) => r(a)))
    expect(res).toBe('8.8.8.8')
  })
})

describe('safeFetch', () => {
  let server: http.Server
  let port = 0
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/redirect-internal') {
        res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' })
        return res.end()
      }
      if (req.url === '/redirect-file') {
        res.writeHead(301, { location: 'file:///etc/passwd' })
        return res.end()
      }
      if (req.url === '/loop') {
        res.writeHead(302, { location: '/loop' })
        return res.end()
      }
      if (req.url === '/big') {
        res.writeHead(200, { 'content-type': 'text/html' })
        return res.end('x'.repeat(200_000))
      }
      if (req.url === '/gzip') {
        res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
        return res.end(zlib.gzipSync('<html><body>compressed</body></html>'))
      }
      if (req.url === '/bomb') {
        res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
        return res.end(zlib.gzipSync(Buffer.alloc(5_000_000, 0x61)))
      }
      if (req.url === '/slow') return setTimeout(() => res.end('late'), 3000)
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body>ok</body></html>')
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    port = (server.address() as AddressInfo).port
  })
  afterAll(() => new Promise<void>((r) => server.close(() => r())))

  const base = () => `http://fixture.agencyos-test.com:8080`
  // Test-only agent that routes the fixture hostname to the local server,
  // bypassing the DNS check so the redirect/size/timeout logic that runs on
  // every hop can be exercised. Production always uses createSafeAgent().
  const agent = () =>
    new Agent({
      connect: (_opts, cb) => {
        const sock = net.connect({ host: '127.0.0.1', port }, () => cb(null, sock))
        sock.on('error', (e: Error) => cb(e, null))
      },
    })

  it('blocks localhost targets before connecting', async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toMatchObject({ kind: 'invalid_url' })
  })

  it('blocks hosts whose DNS answers are private (real safe agent)', async () => {
    const a = createSafeAgent(fakeResolver({ 'rebind.agencyos-test.com': ['127.0.0.1'] }))
    await expect(safeFetch('http://rebind.agencyos-test.com/', {}, a)).rejects.toMatchObject({ kind: 'blocked' })
  })

  it('re-validates redirect targets (blocks redirect to metadata IP)', async () => {
    await expect(safeFetch(`${base()}/redirect-internal`, {}, agent())).rejects.toMatchObject({ kind: 'blocked' })
  })

  it('blocks redirects to non-http protocols', async () => {
    await expect(safeFetch(`${base()}/redirect-file`, {}, agent())).rejects.toBeInstanceOf(SafeFetchError)
  })

  it('stops redirect loops', async () => {
    await expect(safeFetch(`${base()}/loop`, { maxRedirects: 3 }, agent())).rejects.toMatchObject({ kind: 'too_many_redirects' })
  })

  it('caps response size', async () => {
    const res = await safeFetch(`${base()}/big`, { maxBytes: 10_000 }, agent())
    expect(res.truncated).toBe(true)
    expect(res.body.length).toBeLessThanOrEqual(10_000)
  })

  it('decompresses gzip and reports transfer size', async () => {
    const res = await safeFetch(`${base()}/gzip`, {}, agent())
    expect(res.body.toString()).toContain('compressed')
    expect(res.headers['content-encoding']).toBe('gzip')
  })

  it('guards against decompression bombs', async () => {
    const res = await safeFetch(`${base()}/bomb`, { maxBytes: 100_000 }, agent())
    expect(res.truncated).toBe(true)
    expect(res.body.length).toBeLessThanOrEqual(100_000)
  })

  it('enforces timeouts', async () => {
    await expect(safeFetch(`${base()}/slow`, { timeoutMs: 500 }, agent())).rejects.toMatchObject({ kind: 'timeout' })
  })

})
