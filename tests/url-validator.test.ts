import { describe, it, expect } from 'vitest';
import { isSafePublicImageUrl } from '../src/url-validator';

describe('SSRF Protection (isSafePublicImageUrl)', () => {
  it('allows valid public HTTP and HTTPS image URLs', () => {
    expect(isSafePublicImageUrl('https://example.com/photo.jpg').safe).toBe(true);
    expect(isSafePublicImageUrl('https://cdn.photos.com:443/image.webp').safe).toBe(true);
    expect(isSafePublicImageUrl('http://static.social-feed.net/avatar.png').safe).toBe(true);
    expect(isSafePublicImageUrl('https://sub.domain.co.uk/pic.jpeg?w=100').safe).toBe(true);
  });

  it('blocks loopback IP addresses and localhost', () => {
    expect(isSafePublicImageUrl('http://localhost/image.png').safe).toBe(false);
    expect(isSafePublicImageUrl('http://localhost:8000/api/describe').safe).toBe(false);
    expect(isSafePublicImageUrl('http://sub.localhost/pic.jpg').safe).toBe(false);
    expect(isSafePublicImageUrl('http://127.0.0.1/admin.png').safe).toBe(false);
    expect(isSafePublicImageUrl('http://127.0.0.2:1234/test').safe).toBe(false);
    expect(isSafePublicImageUrl('http://[::1]/secret.jpg').safe).toBe(false);
  });

  it('blocks private IPv4 spaces (10.x, 192.168.x, 172.16-31.x)', () => {
    expect(isSafePublicImageUrl('http://10.0.0.1/router.png').safe).toBe(false);
    expect(isSafePublicImageUrl('http://10.255.255.255/intranet').safe).toBe(false);
    expect(isSafePublicImageUrl('http://192.168.1.1/gateway.jpg').safe).toBe(false);
    expect(isSafePublicImageUrl('http://172.16.0.1/corp').safe).toBe(false);
    expect(isSafePublicImageUrl('http://172.31.255.255/internal').safe).toBe(false);
  });

  it('blocks cloud metadata endpoints (169.254.169.254)', () => {
    const awsMetadata = 'http://169.254.169.254/latest/meta-data/iam/security-credentials/';
    const result = isSafePublicImageUrl(awsMetadata);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('169.254.0.0/16');
  });

  it('blocks dangerous internal service ports', () => {
    expect(isSafePublicImageUrl('https://example.com:22/ssh').safe).toBe(false);
    expect(isSafePublicImageUrl('http://example.com:6379/redis').safe).toBe(false);
    expect(isSafePublicImageUrl('http://example.com:8000/fastapi').safe).toBe(false);
    expect(isSafePublicImageUrl('http://example.com:1234/lmstudio').safe).toBe(false);
  });

  it('blocks non-HTTP protocols', () => {
    expect(isSafePublicImageUrl('file:///etc/passwd').safe).toBe(false);
    expect(isSafePublicImageUrl('javascript:alert(1)').safe).toBe(false);
    expect(isSafePublicImageUrl('ftp://ftp.server.com/file').safe).toBe(false);
    expect(isSafePublicImageUrl('gopher://internal/').safe).toBe(false);
  });

  it('blocks internal and single-label domain names', () => {
    expect(isSafePublicImageUrl('http://router/status.jpg').safe).toBe(false);
    expect(isSafePublicImageUrl('http://printer.local/scan.jpg').safe).toBe(false);
    expect(isSafePublicImageUrl('http://server.internal/asset.png').safe).toBe(false);
    expect(isSafePublicImageUrl('http://nas.lan/photo.png').safe).toBe(false);
  });
});
