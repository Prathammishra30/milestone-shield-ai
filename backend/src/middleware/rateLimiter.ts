import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Standardized HTTP 429 Rate Limit Exceeded handler
 */
function rateLimitExceededHandler(message: string) {
  return (_req: Request, res: Response): void => {
    res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      retryAfterSeconds: Math.ceil(res.getHeader('Retry-After') ? Number(res.getHeader('Retry-After')) : 60),
    });
  };
}

const shouldSkip = (): boolean => process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

/**
 * Strict limiter for sensitive authentication & onboarding endpoints
 * Quota: 15 attempts per 15-minute window per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitExceededHandler(
    'Too many authentication attempts from this IP address. Please wait 15 minutes before trying again.'
  ),
  skip: shouldSkip,
});

/**
 * Strict limiter for sensitive financial payment operations (Authorize, Capture, Void)
 * Quota: 25 requests per 15-minute window per IP
 */
export const paymentMutatingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitExceededHandler(
    'Too many payment transactions requested in a short time. Please wait before retrying.'
  ),
  skip: shouldSkip,
});

/**
 * General API Limiter for regular REST endpoints
 * Quota: 120 requests per minute per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitExceededHandler(
    'API rate limit exceeded. Please reduce request frequency.'
  ),
  skip: shouldSkip,
});

/**
 * Rate limiter for incoming webhook endpoints
 * Quota: 120 requests per minute per IP
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitExceededHandler(
    'Too many webhook requests received. Please reduce delivery rate.'
  ),
  skip: shouldSkip,
});

/**
 * Strict limiter for expensive AI verification / milestone breakdown pipelines
 * Quota: 30 requests per 15-minute window per IP
 */
export const aiRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitExceededHandler(
    'AI pipeline request limit reached. Please wait before triggering additional automated milestone analyses.'
  ),
  skip: shouldSkip,
});
