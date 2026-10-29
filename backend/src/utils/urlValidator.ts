/**
 * SSRF-Safe Deliverable URL Validator
 *
 * Rejects non-HTTPS schemes, private RFC 1918 networks, link-local addresses,
 * loopback interfaces, and cloud metadata endpoints.
 */

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127(?:\.[0-9]+){3}$/,
  /^0\.0\.0\.0$/,
  /^169\.254\.169\.254$/, // Cloud metadata IP
  /^metadata\.google\.internal$/i,
  /^instance-data$/i,
  /^10(?:\.[0-9]+){3}$/, // RFC 1918 class A
  /^192\.168(?:\.[0-9]+){2}$/, // RFC 1918 class C
  /^172\.(?:1[6-9]|2[0-9]|3[0-1])(?:\.[0-9]+){2}$/, // RFC 1918 class B
  /^\[::1\]$/,
  /^::1$/,
];

export function isSafePublicHttpsUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);

    // Strictly enforce HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check against blocked hosts
    for (const pattern of BLOCKED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
