import ipaddr from 'ipaddr.js'

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlValidationError'
  }
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home', '.corp', '.home.arpa', '.localdomain', '.test', '.invalid', '.example']
const BLOCKED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata', 'metadata.google.internal', 'instance-data', 'kubernetes', 'kubernetes.default'])
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443'])

/** Extra IPv4 ranges not covered by ipaddr.js range names. */
const EXTRA_BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['240.0.0.0', 4],
]

/**
 * True only for globally routable unicast addresses. Blocks loopback,
 * RFC1918, link-local (incl. cloud metadata 169.254.169.254), CGNAT, ULA,
 * multicast, documentation/benchmark ranges, and IPv6 transition ranges
 * (6to4, Teredo, NAT64) that can embed internal IPv4 addresses.
 */
export function isPublicIp(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false
  let addr = ipaddr.parse(ip)
  if (addr.kind() === 'ipv6' && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
    addr = (addr as ipaddr.IPv6).toIPv4Address()
  }
  if (addr.range() !== 'unicast') return false
  if (addr.kind() === 'ipv4') {
    for (const [base, bits] of EXTRA_BLOCKED_V4) {
      if ((addr as ipaddr.IPv4).match(ipaddr.IPv4.parse(base), bits)) return false
    }
  } else {
    const v6 = addr as ipaddr.IPv6
    // Global unicast is 2000::/3 only.
    if (!v6.match(ipaddr.IPv6.parse('2000::'), 3)) return false
  }
  return true
}

function stripBrackets(host: string) {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
}

/**
 * Normalizes and validates a user-supplied website URL. Performs syntactic
 * checks only; DNS answers are validated at connection time by safe-fetch.
 */
export function validatePublicUrl(input: string): URL {
  const raw = (input ?? '').trim()
  if (!raw) throw new UrlValidationError('Enter a website URL.')
  if (raw.length > 2048) throw new UrlValidationError('The URL is too long.')
  if (/[\s<>"`]/.test(raw)) throw new UrlValidationError('The URL contains invalid characters.')
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new UrlValidationError('Enter a valid URL, for example https://example.com.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UrlValidationError('Only http and https URLs are supported.')
  if (url.username || url.password) throw new UrlValidationError('URLs with embedded credentials are not allowed.')
  if (!ALLOWED_PORTS.has(url.port)) throw new UrlValidationError('Only standard web ports (80, 443, 8080, 8443) are allowed.')

  const host = stripBrackets(url.hostname.toLowerCase()).replace(/\.$/, '')
  if (!host) throw new UrlValidationError('The URL has no host.')
  if (ipaddr.isValid(host)) {
    if (!isPublicIp(host)) throw new UrlValidationError('Private, local and reserved network addresses cannot be audited.')
  } else {
    // Reject decimal/octal/hex IPv4 shorthand that some resolvers accept.
    if (/^[0-9.]+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) throw new UrlValidationError('Enter a valid public hostname.')
    if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
      throw new UrlValidationError('Local and internal hostnames cannot be audited.')
    }
    if (!host.includes('.')) throw new UrlValidationError('Enter a fully qualified domain name, for example example.com.')
    if (!/^[a-z0-9.-]+$/.test(host) || host.split('.').some((l) => !l || l.length > 63 || l.startsWith('-') || l.endsWith('-'))) {
      throw new UrlValidationError('Enter a valid public hostname.')
    }
  }
  url.hash = ''
  return url
}
