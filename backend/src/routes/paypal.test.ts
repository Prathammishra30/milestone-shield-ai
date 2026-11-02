import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { resetPaymentStore, getPaymentByOrderId, getPaymentByAuthorizationId, createPaymentRecord } from '../services/paymentStore';
import { resetMilestonesStore, getMilestoneById } from '../models/milestones';
import { paypalClient } from '../services/paypalClient';
import { AppError } from '../middleware/errorHandler';
import { env, loadEnv } from '../config/env';

/** Deterministic synthetic fixture generator with 0 entropy to prevent secret scanner false positives */
const fixture = (char: string, length: number): string => char.repeat(length);

describe('PayPal Sandbox Payment Lifecycle (Milestone 2A)', () => {
  const app = createApp();

  beforeEach(() => {
    resetPaymentStore();
    resetMilestonesStore();
    paypalClient.clearCachedToken();
    vi.restoreAllMocks();

    // Ensure mock PayPal credentials are present for tests
    env.PAYPAL_CLIENT_ID = fixture('c', 24);
    env.PAYPAL_CLIENT_SECRET = fixture('s', 32);
    env.PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Configuration & Host Rejection ─────────────────────────────

  describe('Configuration & Host Guard', () => {
    it('strictly rejects production PayPal hosts', () => {
      expect(() =>
        loadEnv({
          ...process.env,
          PAYPAL_BASE_URL: 'https://api-m.paypal.com',
        }),
      ).toThrow(/PAYPAL_BASE_URL must target PayPal Sandbox/);

      expect(() =>
        loadEnv({
          ...process.env,
          PAYPAL_BASE_URL: 'https://api.paypal.com',
        }),
      ).toThrow(/PAYPAL_BASE_URL must target PayPal Sandbox/);
    });

    it('accepts sandbox PayPal hosts', () => {
      const parsed = loadEnv({
        ...process.env,
        PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
      });
      expect(parsed.PAYPAL_BASE_URL).toBe('https://api-m.sandbox.paypal.com');
    });

    it('redacts sensitive client credentials for logging', () => {
      expect(paypalClient.redact('secret_token_123456789')).toBe('secr...6789');
      expect(paypalClient.redact('short')).toBe('***');
      expect(paypalClient.redact(undefined)).toBe('[EMPTY]');
    });

    it('throws AppError(500) if PayPal credentials are missing when requesting token', async () => {
      env.PAYPAL_CLIENT_ID = '';
      env.PAYPAL_CLIENT_SECRET = '';

      await expect(paypalClient.getAccessToken()).rejects.toThrow(
        /PayPal Sandbox credentials are not configured/,
      );
    });
  });

  // ── 2. Create Orders v2 with Intent AUTHORIZE ─────────────────────

  describe('POST /api/milestones/:id/paypal/order', () => {
    it('creates an Orders v2 order with intent AUTHORIZE for known milestone', async () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      // Mock OAuth token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      // Mock Create Order
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'TEST-ORDER-001',
          status: 'CREATED',
          links: [
            {
              rel: 'approve',
              href: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER-001',
              method: 'GET',
            },
            {
              rel: 'self',
              href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/TEST-ORDER-001',
              method: 'GET',
            },
          ],
        }),
      });

      const res = await request(app)
        .post('/api/milestones/ms-003/paypal/order')
        .send({
          returnUrl: 'http://localhost:5173/overview?paypal_return=true',
          cancelUrl: 'http://localhost:5173/overview?paypal_cancel=true',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.orderId).toBe('TEST-ORDER-001');
      expect(res.body.data.status).toBe('CREATED');
      expect(res.body.data.approveUrl).toContain('https://www.sandbox.paypal.com/checkoutnow?token=');
      expect(res.body.data.amount).toBe(2500); // Derived from ms-003
      expect(res.body.data.currency).toBe('USD');

      // Verify server persisted to in-memory store
      const stored = getPaymentByOrderId('TEST-ORDER-001');
      expect(stored).toBeDefined();
      expect(stored?.status).toBe('ORDER_CREATED');
      expect(stored?.milestoneId).toBe('ms-003');
      expect(stored?.amount).toBe(2500);
      expect(stored?.auditTrail[0].action).toBe('ORDER_CREATED');
    });

    // ── F-8: Redirect URL Allowlist ─────────────────────────────────

    it('F-8: rejects returnUrl with javascript: scheme', async () => {
      const res = await request(app)
        .post('/api/milestones/ms-003/paypal/order')
        .send({
          returnUrl: 'javascript:alert(document.cookie)',
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('F-8: rejects returnUrl with http:// (non-HTTPS) external domain', async () => {
      const res = await request(app)
        .post('/api/milestones/ms-003/paypal/order')
        .send({
          returnUrl: 'http://attacker.evil.com/redirect',
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('F-8: rejects returnUrl with look-alike paypal domain', async () => {
      const res = await request(app)
        .post('/api/milestones/ms-003/paypal/order')
        .send({
          returnUrl: 'https://paypal.com.evil.io/redirect',
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('F-8: rejects cancelUrl with javascript: scheme', async () => {
      const res = await request(app)
        .post('/api/milestones/ms-003/paypal/order')
        .send({
          cancelUrl: 'javascript:alert(1)',
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('F-8: accepts returnUrl matching configured frontend origin (CORS_ORIGIN)', async () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'TEST-ORDER-F8',
          status: 'CREATED',
          links: [
            {
              rel: 'approve',
              href: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER-F8',
              method: 'GET',
            },
          ],
        }),
      });

      const res = await request(app)
        .post('/api/milestones/ms-003/paypal/order')
        .send({
          returnUrl: 'http://localhost:5173/overview?paypal_return=true',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
    });

    it('rejects client-supplied amounts (financial safety check)', async () => {
      const res = await request(app)
        .post('/api/milestones/ms-003/paypal/order')
        .send({
          amount: 10, // Attempting to tamper with amount
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors[0].message).toContain('Client-supplied amounts are strictly forbidden');
    });

    it('returns 404 for unknown milestone', async () => {
      const res = await request(app).post('/api/milestones/ms-unknown/paypal/order').send({});
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Milestone not found');
    });

    it('returns 400 when attempting to order an already paid milestone', async () => {
      const res = await request(app).post('/api/milestones/ms-001/paypal/order').send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already settled/paid');
    });
  });

  // ── 3. Authorize Order ────────────────────────────────────────────

  describe('POST /api/payments/paypal/orders/:id/authorize', () => {
    it('authorizes an order after buyer approval and transitions status to AUTHORIZED', async () => {
      // Setup existing payment in store
      createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-APPROVE-123',
      });

      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      // Mock OAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      // Mock Authorize Order
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'ORD-APPROVE-123',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                authorizations: [
                  {
                    id: 'AUTH-TEST-789',
                    status: 'CREATED',
                    amount: {
                      currency_code: 'USD',
                      value: '2500.00',
                    },
                    expiration_time: '2026-11-28T00:00:00Z',
                  },
                ],
              },
            },
          ],
        }),
      });

      const res = await request(app)
        .post('/api/payments/paypal/orders/ORD-APPROVE-123/authorize')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.orderId).toBe('ORD-APPROVE-123');
      expect(res.body.data.authorizationId).toBe('AUTH-TEST-789');
      expect(res.body.data.status).toBe('AUTHORIZED');

      // Verify payment store updated
      const updated = getPaymentByOrderId('ORD-APPROVE-123');
      expect(updated?.status).toBe('AUTHORIZED');
      expect(updated?.paypalAuthorizationId).toBe('AUTH-TEST-789');
      expect(updated?.auditTrail.some((e) => e.action === 'AUTHORIZED')).toBe(true);
    });

    it('rejects re-authorizing an already authorized order with 409 Conflict', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-ALREADY-AUTH',
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-ALREADY';

      const res = await request(app)
        .post('/api/payments/paypal/orders/ORD-ALREADY-AUTH/authorize')
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('is already authorized');
    });
  });

  // ── 4. Explicit Capture of Authorized Payment ─────────────────────

  describe('POST /api/payments/paypal/authorizations/:id/capture', () => {
    it('captures an authorized payment when explicit confirmation is provided', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-TO-CAPTURE',
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-READY-TO-CAPTURE';

      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      // Mock OAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      // Mock Capture
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'CAP-TEST-999',
          status: 'COMPLETED',
          amount: {
            currency_code: 'USD',
            value: '2500.00',
          },
        }),
      });

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-READY-TO-CAPTURE/capture')
        .send({
          confirmed: true,
          operatorNote: 'Milestone acceptance criteria verified. Client released funds.',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.captureId).toBe('CAP-TEST-999');
      expect(res.body.data.status).toBe('CAPTURED');

      // Verify store updated
      const updated = getPaymentByAuthorizationId('AUTH-READY-TO-CAPTURE');
      expect(updated?.status).toBe('CAPTURED');
      expect(updated?.paypalCaptureId).toBe('CAP-TEST-999');

      // Verify trusted milestone updated to paid
      const ms = getMilestoneById('ms-003');
      expect(ms?.status).toBe('paid');
    });

    it('rejects capture if explicit confirmation is missing (confirmed: false)', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-UNCONFIRMED',
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-UNCONFIRMED';

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-UNCONFIRMED/capture')
        .send({
          confirmed: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Explicit release confirmation');
    });

    it('prevents duplicate captures with 409 Conflict', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-DUPLICATE',
      });
      payment.status = 'CAPTURED';
      payment.paypalAuthorizationId = 'AUTH-DUPLICATE';
      payment.paypalCaptureId = 'CAP-ORIGINAL';

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-DUPLICATE/capture')
        .send({
          confirmed: true,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('has already been captured');

      // Verify duplicate capture audit event was logged
      const updated = getPaymentByAuthorizationId('AUTH-DUPLICATE');
      expect(updated?.auditTrail.some((e) => e.action === 'DUPLICATE_CAPTURE_PREVENTED')).toBe(true);
    });

    // ── F-7: Atomic Transitions & Idempotency ─────────────────────────

    it('F-7: concurrent captures on one authorization produce exactly one successful capture', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-CONCURRENT-CAP',
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-CONCURRENT-CAP';

      let captureCallCount = 0;
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      mockFetch.mockImplementation(() => {
        captureCallCount++;
        if (captureCallCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            id: 'CAP-CONCURRENT-001',
            status: 'COMPLETED',
            amount: { currency_code: 'USD', value: '2500.00' },
          }),
        });
      });

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app)
            .post('/api/payments/paypal/authorizations/AUTH-CONCURRENT-CAP/capture')
            .send({ confirmed: true })
        )
      );

      const successCount = results.filter((r) => r.status === 200).length;
      const conflictCount = results.filter((r) => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(4);

      const updated = getPaymentByAuthorizationId('AUTH-CONCURRENT-CAP');
      expect(updated?.status).toBe('CAPTURED');
    });

    it('F-7: idempotent capture retry returns 409 without calling PayPal again', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-IDEMPOTENT',
      });
      payment.status = 'CAPTURED';
      payment.paypalAuthorizationId = 'AUTH-IDEMPOTENT';
      payment.paypalCaptureId = 'CAP-EXISTING';

      let paypalCallCount = 0;
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;
      mockFetch.mockImplementation(() => {
        paypalCallCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'mock-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        });
      });

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-IDEMPOTENT/capture')
        .send({
          confirmed: true,
          idempotencyKey: 'cap-idempotent-retry',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('has already been captured');
      expect(paypalCallCount).toBe(0);
    });

    it('F-7: server-side idempotency key reuse is rejected', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-IDEMP-KEY',
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-IDEMP-KEY';

      let paypalCallCount = 0;
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;
      mockFetch.mockImplementation(() => {
        paypalCallCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'mock-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        });
      });

      const res1 = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-IDEMP-KEY/capture')
        .send({
          confirmed: true,
          idempotencyKey: 'cap-server-side-key-001',
        });
      expect(res1.status).toBe(200);

      // Record PayPal call count after the first (successful) capture.
      // The first capture makes 2 fetch calls (OAuth token + capture endpoint).
      const callsAfterFirstCapture = paypalCallCount;
      expect(callsAfterFirstCapture).toBeGreaterThan(0);

      // Second capture with SAME idempotency key should be rejected WITHOUT calling PayPal.
      const res2 = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-IDEMP-KEY/capture')
        .send({
          confirmed: true,
          idempotencyKey: 'cap-server-side-key-001',
        });

      // PayPal call count must NOT increase (second request short-circuits before PayPal).
      expect(paypalCallCount).toBe(callsAfterFirstCapture);
      expect(res2.status).toBe(409);
    });

    it('rejects capture when payment is in VOIDED state', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-VOIDED',
      });
      payment.status = 'VOIDED';
      payment.paypalAuthorizationId = 'AUTH-VOIDED';

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-VOIDED/capture')
        .send({
          confirmed: true,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Voided authorizations cannot be captured');
    });

    // ── F-12: Authorization Expiry ──────────────────────────────────

    it('rejects capture of expired authorization with 409 Conflict', async () => {
      const expiredTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'Expired Authorization Test',
        projectId: 'proj-001',
        projectName: 'Expiry Test Project',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-EXPIRED-CAP',
        authorizationExpirationTime: expiredTime,
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-EXPIRED-CAP';

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-EXPIRED-CAP/capture')
        .send({
          confirmed: true,
          operatorNote: 'Attempting capture after expiry.',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('expired');
      expect(res.body.message).toContain('cannot be captured');
    });

    it('rejects void of expired authorization with 409 Conflict', async () => {
      const expiredTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'Expired Authorization Void Test',
        projectId: 'proj-001',
        projectName: 'Expiry Test Project',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-EXPIRED-VOID',
        authorizationExpirationTime: expiredTime,
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-EXPIRED-VOID';

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-EXPIRED-VOID/void')
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('expired');
      expect(res.body.message).toContain('cannot be voided');
    });

    it('allows capture of non-expired authorization', async () => {
      const futureTime = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'Valid Authorization Test',
        projectId: 'proj-001',
        projectName: 'Valid Expiry Test Project',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-VALID-CAP',
        authorizationExpirationTime: futureTime,
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-VALID-CAP';

      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'CAP-VALID-999',
          status: 'COMPLETED',
          amount: {
            currency_code: 'USD',
            value: '2500.00',
          },
        }),
      });

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-VALID-CAP/capture')
        .send({
          confirmed: true,
          operatorNote: 'Capture before expiry.',
        });

      expect(res.status).toBe(200);
      const updated = getPaymentByAuthorizationId('AUTH-VALID-CAP');
      expect(updated?.status).toBe('CAPTURED');
    });
  });

  // ── 5. Void Authorization ─────────────────────────────────────────

  describe('POST /api/payments/paypal/authorizations/:id/void', () => {
    it('voids an uncaptured authorization', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-TO-VOID',
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-TO-VOID';

      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      // Mock OAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      // Mock Void (HTTP 204)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-TO-VOID/void')
        .send({
          reason: 'Client cancelled contract before milestone start',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('VOIDED');

      const updated = getPaymentByAuthorizationId('AUTH-TO-VOID');
      expect(updated?.status).toBe('VOIDED');
    });

    it('rejects voiding a captured authorization with 409 Conflict', async () => {
      const payment = createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-CAPTURED-CANNOT-VOID',
      });
      payment.status = 'CAPTURED';
      payment.paypalAuthorizationId = 'AUTH-CAPTURED';

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-CAPTURED/void')
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('because it has already been captured');
    });
  });

  // ── 6. Read Endpoints ─────────────────────────────────────────────

  describe('GET /api/payments/paypal and detail endpoints', () => {
    it('returns all tracked payments and summary stats', async () => {
      createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Payment Gateway Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform Redesign & Implementation',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-LIST-1',
      });

      const res = await request(app).get('/api/payments/paypal');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.payments).toHaveLength(1);
      expect(res.body.data.summary.totalTracked).toBe(1);
      expect(res.body.data.notice).toContain('Not an escrow service');
    });

    it('returns 404 for unknown milestone payment lookup', async () => {
      const res = await request(app).get('/api/payments/paypal/milestone/unknown-ms');
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });

    // ── F-12: Excessive error details ──────────────────────────────────
    it('sanitizes PayPal API error messages - no debug ID leaked', async () => {
      // This test verifies that paypalClient sanitizes error messages,
      // not leaking PayPal debug IDs or detailed issue descriptions to clients.
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      // Mock OAuth token success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      // Mock PayPal API error response (400 Bad Request) with debug_id and details
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'INVALID_ARGUMENT',
          name: 'Bad Request',
          details: [
            { issue: 'UNKNOWN', description: 'Invalid payer authentication' },
          ],
          debug_id: 'ffl1234567890',
        }),
      });

      const res = await request(app)
        .post('/api/milestones/ms-003/paypal/order')
        .set('Authorization', 'Bearer test-token:usr-client-001:client')
        .send({
          milestoneId: 'ms-003',
        });

      // The response should be 400 or 500 (depending on error path)
      expect(res.status).toBeDefined();
      // Must not contain PayPal debug ID format
      expect(res.body.message).not.toMatch(/ffl1234567890/);
      // Must not contain raw issue/description details
      expect(res.body.message).not.toMatch(/UNKNOWN: Invalid payer authentication/);
    });
  });

  // ── 7. Production Fail-Closed Database Integrity ──────────────────

  describe('Production Fail-Closed Database Integrity', () => {
    it('STRICTLY FAILS CLOSED in production if database client is unavailable', async () => {
      const originalNodeEnv = env.NODE_ENV;
      const originalJwtSecret = env.SUPABASE_JWT_SECRET;
      const originalCorsOrigin = env.CORS_ORIGIN;

      (env as Record<string, unknown>).NODE_ENV = 'production';
      (env as Record<string, unknown>).SUPABASE_JWT_SECRET = fixture('j', 40);
      (env as Record<string, unknown>).CORS_ORIGIN = 'https://app.milestoneshield.ai';

      const validToken = jwt.sign(
        {
          sub: 'usr-client-001',
          email: 'client@example.com',
          aud: 'authenticated',
          app_metadata: { role: 'client' },
        },
        env.SUPABASE_JWT_SECRET
      );

      vi.spyOn(paypalClient, 'createAuthorizeOrder').mockResolvedValueOnce({
        orderId: 'ORD-PROD-TEST',
        status: 'CREATED',
        approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=PROD',
      });

      const res = await request(app)
        .post('/api/milestones/ms-003/paypal/order')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          returnUrl: 'https://app.milestoneshield.ai/return',
          cancelUrl: 'https://app.milestoneshield.ai/cancel',
        });

      // Must fail closed with 500 instead of returning a fake in-memory payment success
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal server error');

      (env as Record<string, unknown>).NODE_ENV = originalNodeEnv;
      (env as Record<string, unknown>).SUPABASE_JWT_SECRET = originalJwtSecret;
      (env as Record<string, unknown>).CORS_ORIGIN = originalCorsOrigin;
    });
  });
});
