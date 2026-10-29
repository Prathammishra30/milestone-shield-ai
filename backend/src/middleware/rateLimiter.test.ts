import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

describe('Phase 3: Rate Limiting & HTTP 429 Verification', () => {
  it('correctly returns HTTP 429 when rate limit quota is exceeded', async () => {
    const testApp = express();

    // Create a strict test limiter of 3 requests per second
    const testLimiter = rateLimit({
      windowMs: 1000,
      max: 3,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          status: 'error',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please wait before retrying.',
        });
      },
    });

    testApp.use('/test-endpoint', testLimiter, (_req, res) => {
      res.json({ status: 'ok' });
    });

    // Requests 1, 2, 3 should succeed
    const res1 = await request(testApp).get('/test-endpoint');
    expect(res1.status).toBe(200);

    const res2 = await request(testApp).get('/test-endpoint');
    expect(res2.status).toBe(200);

    const res3 = await request(testApp).get('/test-endpoint');
    expect(res3.status).toBe(200);

    // Request 4 should be rejected with 429
    const res4 = await request(testApp).get('/test-endpoint');
    expect(res4.status).toBe(429);
    expect(res4.body.status).toBe('error');
    expect(res4.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res4.body.message).toMatch(/Rate limit exceeded/i);
  });
});
