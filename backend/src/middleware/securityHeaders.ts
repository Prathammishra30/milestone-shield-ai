import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Security Headers Middleware
 *
 * Enforces OWASP-recommended HTTP security headers:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS in production)
 * - X-Frame-Options (Clickjacking defense)
 * - X-Content-Type-Options (MIME sniffing defense)
 * - Referrer-Policy and Permissions-Policy
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent framing (clickjacking defense)
  res.setHeader('X-Frame-Options', 'DENY');

  // Restrict referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict browser device hardware features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Cross-Origin resource boundaries
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  // HSTS in production (never enabled on localhost development)
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api-m.sandbox.paypal.com https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  next();
}
