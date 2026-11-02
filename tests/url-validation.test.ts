import { describe, expect, it } from 'vitest'
import { isPublicIp, validatePublicUrl, UrlValidationError } from '@/lib/security/url-validation'

describe('isPublicIp', () => {
  it.each([
    '127.0.0.1', '127.255.0.9', '10.0.0.1', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '255.255.255.255', '224.0.0.1',
    '192.0.2.10', '198.18.0.1', '203.0.113.5', '240.0.0.1', '::1', '::', 'fe80::1', 'fc00::1', 'fd00:ec2::254', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
    '2002:7f00:0001::1', '2001:0:4136:e378:8000:63bf:3fff:fdd2', '64:ff9b::7f00:1', '2001:db8::1', 'not-an-ip',
  ])('blocks %s', (ip) => expect(isPublicIp(ip)).toBe(false))

  it.each(['8.8.8.8', '1.1.1.1', '93.184.215.14', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('allows public %s', (ip) => expect(isPublicIp(ip)).toBe(true))
})

describe('validatePublicUrl', () => {
  const bad = [
    ['', 'empty'],
    ['javascript:alert(1)', 'javascript scheme'],
    ['file:///etc/passwd', 'file scheme'],
    ['ftp://example.com', 'ftp scheme'],
    ['gopher://example.com', 'gopher scheme'],
    ['http://localhost', 'localhost'],
    ['http://LOCALHOST:80/', 'localhost uppercase'],
    ['http://app.localhost', 'localhost subdomain'],
    ['http://printer.local', 'mDNS'],
    ['http://metadata.google.internal/computeMetadata/v1/', 'metadata host'],
    ['http://127.0.0.1', 'loopback v4'],
    ['http://[::1]/', 'loopback v6'],
    ['http://[::ffff:127.0.0.1]/', 'mapped loopback'],
    ['http://169.254.169.254/latest/meta-data/', 'cloud metadata'],
    ['http://10.1.2.3/', 'private'],
    ['http://2130706433/', 'decimal IPv4'],
    ['http://0x7f000001/', 'hex IPv4'],
    ['http://017700000001/', 'octal IPv4'],
    ['http://intranet/', 'single label'],
    ['https://user:pass@example.com', 'credentials'],
    ['https://example.com:22/', 'non-web port'],
    ['https://example.com:6379/', 'redis port'],
    ['https://exa mple.com', 'whitespace'],
  ]
  it.each(bad)('rejects %s (%s)', (input) => expect(() => validatePublicUrl(input)).toThrow(UrlValidationError))

  it('adds https:// when the scheme is missing', () => expect(validatePublicUrl('agencyos.ai/pricing').toString()).toBe('https://agencyos.ai/pricing'))
  it('strips fragments and keeps query', () => expect(validatePublicUrl('https://Example.com/a?b=1#frag').toString()).toBe('https://example.com/a?b=1'))
  it('allows standard alternative ports', () => expect(validatePublicUrl('http://example.com:8080/').port).toBe('8080'))
  it('allows public IP literals', () => expect(validatePublicUrl('http://8.8.8.8/').hostname).toBe('8.8.8.8'))
  it('rejects overly long URLs', () => expect(() => validatePublicUrl(`https://example.com/${'a'.repeat(2100)}`)).toThrow())
})
