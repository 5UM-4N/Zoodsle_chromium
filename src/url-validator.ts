/**
 * ZoodSle URL Security Validator
 * Validates external image URLs to prevent SSRF and intranet enumeration.
 */

export interface UrlValidationResult {
  safe: boolean;
  reason?: string;
}

const DISALLOWED_DOMAIN_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.corp',
  '.arpa',
  '.test',
  '.example',
  '.invalid',
];

const RESTRICTED_PORTS = new Set([
  21, 22, 23, 25, 53, 69, 110, 111, 135, 137, 138, 139, 143, 445,
  1234, 2049, 2375, 2376, 3306, 5432, 6379, 8000, 8081, 9200, 11211, 27017,
]);

export function isSafePublicImageUrl(urlStr: string): UrlValidationResult {
  if (!urlStr || typeof urlStr !== 'string') {
    return { safe: false, reason: 'Empty or invalid URL string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: 'Malformed URL' };
  }

  // 1. Strict Protocol Check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Disallowed protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase().trim().replace(/\.+$/, '');
  if (!hostname) {
    return { safe: false, reason: 'Empty hostname' };
  }

  // 2. Reject Localhost & Local TLDs
  if (hostname === 'localhost' || DISALLOWED_DOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { safe: false, reason: `Private/internal domain not allowed: ${hostname}` };
  }

  // 3. Reject Single-Label Hostnames (e.g., http://router/ or http://metadata/)
  const isIpv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(hostname);
  const isIpv6 = hostname.startsWith('[') && hostname.endsWith(']');
  if (!isIpv4 && !isIpv6 && !hostname.includes('.')) {
    return { safe: false, reason: `Single-label internal hostname not allowed: ${hostname}` };
  }

  // 4. Port Validation
  const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
  if (isNaN(port) || port < 1 || port > 65535) {
    return { safe: false, reason: 'Invalid port number' };
  }
  if (RESTRICTED_PORTS.has(port)) {
    return { safe: false, reason: `Restricted service port blocked: ${port}` };
  }

  // 5. IPv4 Space Validation
  if (isIpv4) {
    const parts = hostname.split('.').map((p) => parseInt(p, 10));
    const [o1, o2, o3] = parts;

    if (parts.some((p) => p > 255 || p < 0)) {
      return { safe: false, reason: 'Invalid IPv4 octet' };
    }

    // 0.0.0.0/8 (Current network)
    if (o1 === 0) return { safe: false, reason: 'Current network (0.0.0.0/8) not allowed' };
    // 10.0.0.0/8 (Private)
    if (o1 === 10) return { safe: false, reason: 'Private IP range (10.0.0.0/8) not allowed' };
    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) return { safe: false, reason: 'Loopback address (127.0.0.0/8) not allowed' };
    // 169.254.0.0/16 (Link-local / Cloud metadata: 169.254.169.254)
    if (o1 === 169 && o2 === 254) return { safe: false, reason: 'Link-local/metadata address (169.254.0.0/16) not allowed' };
    // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return { safe: false, reason: 'Private IP range (172.16.0.0/12) not allowed' };
    // 192.168.0.0/16 (Private)
    if (o1 === 192 && o2 === 168) return { safe: false, reason: 'Private IP range (192.168.0.0/16) not allowed' };
    // 100.64.0.0/10 (Carrier-Grade NAT: 100.64.0.0 - 100.127.255.255)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return { safe: false, reason: 'Carrier-grade NAT range (100.64.0.0/10) not allowed' };
    // 192.0.2.0/24 (TEST-NET-1)
    if (o1 === 192 && o2 === 0 && o3 === 2) return { safe: false, reason: 'Documentation IP range not allowed' };
    // 198.18.0.0/15 (Network benchmark)
    if (o1 === 198 && (o2 === 18 || o2 === 19)) return { safe: false, reason: 'Benchmark range not allowed' };
    // 198.51.100.0/24 (TEST-NET-2)
    if (o1 === 198 && o2 === 51 && o3 === 100) return { safe: false, reason: 'Documentation IP range not allowed' };
    // 203.0.113.0/24 (TEST-NET-3)
    if (o1 === 203 && o2 === 0 && o3 === 113) return { safe: false, reason: 'Documentation IP range not allowed' };
    // 224.0.0.0/4 (Multicast: 224 - 239)
    if (o1 >= 224 && o1 <= 239) return { safe: false, reason: 'Multicast address not allowed' };
    // 240.0.0.0/4 (Reserved: 240 - 255)
    if (o1 >= 240) return { safe: false, reason: 'Reserved address not allowed' };
  }

  // 6. IPv6 Space Validation
  const cleanIpv6 = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    cleanIpv6 === '::1' ||
    cleanIpv6 === '::' ||
    cleanIpv6.startsWith('fe8') ||
    cleanIpv6.startsWith('fe9') ||
    cleanIpv6.startsWith('fea') ||
    cleanIpv6.startsWith('feb') ||
    cleanIpv6.startsWith('fc') ||
    cleanIpv6.startsWith('fd') ||
    cleanIpv6.includes('::ffff:')
  ) {
    return { safe: false, reason: `Private/loopback IPv6 address not allowed: ${cleanIpv6}` };
  }

  return { safe: true };
}
