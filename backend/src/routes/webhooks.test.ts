import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import {
  resetPaymentStore,
  createPaymentRecord,
  getPaymentById,
  getPaymentByOrderId,
  getPaymentByAuthorizationId,
} from '../services/paymentStore';
import { resetWebhookEventStore } from '../services/webhookEventStore';
import { resetMilestonesStore, getMilestoneById } from '../models/milestones';
import { paypalClient } from '../services/paypalClient';
import { env } from '../config/env';

describe('PayPal Webhook Signature Verification & Lifecycle Reconciliation (Milestone 2A)', () => {
  const app = createApp();

  const validHeaders = {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-test-12345',
    'paypal-transmission-id': 'test-trans-id-001',
    'paypal-transmission-sig': 'test-signature-base64-string',
    'paypal-transmission-time': '2026-10-29T12:00:00Z',
  };

  beforeEach(() => {
    resetPaymentStore();
    resetWebhookEventStore();
    resetMilestonesStore();
    paypalClient.clearCachedToken();
    vi.restoreAllMocks();

    env.PAYPAL_CLIENT_ID = 'test-client-id';
    env.PAYPAL_CLIENT_SECRET = 'test-client-secret';
    env.PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com';
    env.PAYPAL_WEBHOOK_ID = 'WH-test-webhook-id-12345';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Configuration & Credential Guards ──────────────────────────

  describe('Configuration Guards', () => {
    it('fails safely with HTTP 500 if PAYPAL_WEBHOOK_ID is not configured', async () => {
      env.PAYPAL_WEBHOOK_ID = '';

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-001',
          event_type: 'PAYMENT.AUTHORIZATION.CREATED',
          resource: { id: 'AUTH-123' },
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/PAYPAL_WEBHOOK_ID is not configured/i);
    });
  });

  // ── 2. Transmission Headers & SSRF Validation ─────────────────────

  describe('Transmission Headers & Security Rules', () => {
    it('rejects with 400 when missing paypal-auth-algo', async () => {
      const { 'paypal-auth-algo': _, ...headers } = validHeaders;

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(headers)
        .send({ id: 'WH-EVT-001', event_type: 'PAYMENT.AUTHORIZATION.CREATED' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_TRANSMISSION_HEADERS');
    });

    it('rejects with 400 when missing paypal-transmission-sig', async () => {
      const { 'paypal-transmission-sig': _, ...headers } = validHeaders;

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(headers)
        .send({ id: 'WH-EVT-001', event_type: 'PAYMENT.AUTHORIZATION.CREATED' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_TRANSMISSION_HEADERS');
    });

    it('strictly rejects non-HTTPS or external cert_url (SSRF defense)', async () => {
      const maliciousHeaders = {
        ...validHeaders,
        'paypal-cert-url': 'https://attacker.evil.com/malicious-cert.pem',
      };

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(maliciousHeaders)
        .send({ id: 'WH-EVT-001', event_type: 'PAYMENT.AUTHORIZATION.CREATED' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CERT_URL');
      expect(res.body.message).toMatch(/must target a trusted \*\.paypal\.com domain/i);
    });

    it('strictly rejects HTTP (insecure) cert_url', async () => {
      const insecureHeaders = {
        ...validHeaders,
        'paypal-cert-url': 'http://api-m.sandbox.paypal.com/cert.pem',
      };

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(insecureHeaders)
        .send({ id: 'WH-EVT-001', event_type: 'PAYMENT.AUTHORIZATION.CREATED' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CERT_URL');
    });
  });

  // ── 3. Malformed Event Payloads ───────────────────────────────────

  describe('Malformed Event Payloads', () => {
    it('rejects with 400 when event body is missing event_type', async () => {
      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({ id: 'WH-EVT-001' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_EVENT_STRUCTURE');
    });

    it('rejects with 400 when event body is missing event id', async () => {
      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({ event_type: 'PAYMENT.CAPTURE.COMPLETED' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_EVENT_STRUCTURE');
    });
  });

  // ── 4. Cryptographic Signature Verification (Mocks vs Real) ───────

  describe('Cryptographic Signature Verification', () => {
    it('REJECTS webhook with 400 if PayPal reports signature verification FAILURE', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'FAILURE',
      });

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-FAIL-001',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: 'CAP-123' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SIGNATURE_VERIFICATION_FAILED');
      expect(res.body.message).toMatch(/signature verification failed/i);
    });

    it('ACCEPTS webhook with 200 when PayPal confirms signature verification SUCCESS', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-OK-001',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: 'CAP-NONEXISTENT' },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  // ── 5. Idempotent Event Processing (Deduplication) ────────────────

  describe('Idempotency & Duplicate Delivery', () => {
    it('acknowledges duplicate webhook deliveries with 200 without duplicate transitions', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValue({
        verificationStatus: 'SUCCESS',
      });

      const payload = {
        id: 'WH-EVT-DUP-001',
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: { id: 'ORD-DUP-001' },
      };

      // 1. First delivery
      const res1 = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send(payload);
      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('success');

      // 2. Duplicate replayed delivery
      const res2 = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.code).toBe('DUPLICATE_EVENT_IGNORED');
      expect(res2.body.message).toMatch(/already been processed/i);
    });
  });

  // ── 6. State Lifecycle Reconciliation ─────────────────────────────

  describe('Payment Lifecycle Reconciliation', () => {
    it('reconciles PAYMENT.AUTHORIZATION.CREATED from ORDER_CREATED to AUTHORIZED', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const payment = createPaymentRecord({
        milestoneId: 'ms-001',
        milestoneTitle: 'UI Architecture',
        projectId: 'prj-001',
        projectName: 'Web App',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-AUTH-TEST',
      });

      expect(payment.status).toBe('ORDER_CREATED');

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-AUTH-001',
          event_type: 'PAYMENT.AUTHORIZATION.CREATED',
          resource: {
            id: 'AUTH-TEST-777',
            status: 'CREATED',
            amount: { currency_code: 'USD', value: '2500.00' },
            supplementary_data: { related_ids: { order_id: 'ORD-AUTH-TEST' } },
          },
        });

      expect(res.status).toBe(200);
      const updated = getPaymentById(payment.id);
      expect(updated?.status).toBe('AUTHORIZED');
      expect(updated?.paypalAuthorizationId).toBe('AUTH-TEST-777');
    });

    it('reconciles PAYMENT.CAPTURE.COMPLETED: transitions to CAPTURED and marks milestone paid', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const payment = createPaymentRecord({
        milestoneId: 'ms-001',
        milestoneTitle: 'UI Architecture',
        projectId: 'prj-001',
        projectName: 'Web App',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-CAP-TEST',
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-CAP-TEST';

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-CAP-001',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: 'CAP-TEST-888',
            status: 'COMPLETED',
            amount: { currency_code: 'USD', value: '2500.00' },
            parent_payment: 'AUTH-CAP-TEST',
          },
        });

      expect(res.status).toBe(200);
      const updated = getPaymentById(payment.id);
      expect(updated?.status).toBe('CAPTURED');
      expect(updated?.paypalCaptureId).toBe('CAP-TEST-888');

      const milestone = getMilestoneById('ms-001');
      expect(milestone?.status).toBe('paid');
    });

    it('reconciles PAYMENT.AUTHORIZATION.VOIDED from AUTHORIZED to VOIDED', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const payment = createPaymentRecord({
        milestoneId: 'ms-001',
        milestoneTitle: 'UI Architecture',
        projectId: 'prj-001',
        projectName: 'Web App',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-VOID-TEST',
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-VOID-TEST';

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-VOID-001',
          event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
          resource: {
            id: 'AUTH-VOID-TEST',
            status: 'VOIDED',
          },
        });

      expect(res.status).toBe(200);
      const updated = getPaymentById(payment.id);
      expect(updated?.status).toBe('VOIDED');
    });

    it('reconciles PAYMENT.CAPTURE.DENIED to FAILED without altering captured funds', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const payment = createPaymentRecord({
        milestoneId: 'ms-001',
        milestoneTitle: 'UI Architecture',
        projectId: 'prj-001',
        projectName: 'Web App',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-DENIED-TEST',
      });
      payment.status = 'AUTHORIZED';
      payment.paypalAuthorizationId = 'AUTH-DENIED-TEST';

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-DENIED-001',
          event_type: 'PAYMENT.CAPTURE.DENIED',
          resource: {
            id: 'CAP-DENIED-TEST',
            parent_payment: 'AUTH-DENIED-TEST',
            status: 'DENIED',
          },
        });

      expect(res.status).toBe(200);
      const updated = getPaymentById(payment.id);
      expect(updated?.status).toBe('FAILED');
    });
  });

  // ── 7. Out-of-Order & State Downgrade Prevention ───────────────────

  describe('Out-of-Order & State Downgrade Prevention', () => {
    it('STRICTLY PREVENTS state downgrade: Stale AUTHORIZATION.CREATED cannot overwrite CAPTURED state', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const payment = createPaymentRecord({
        milestoneId: 'ms-001',
        milestoneTitle: 'UI Architecture',
        projectId: 'prj-001',
        projectName: 'Web App',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-SETTLED-001',
      });
      payment.status = 'CAPTURED';
      payment.paypalAuthorizationId = 'AUTH-SETTLED-001';
      payment.paypalCaptureId = 'CAP-SETTLED-001';

      // Stale event arrives after capture
      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-STALE-AUTH',
          event_type: 'PAYMENT.AUTHORIZATION.CREATED',
          resource: {
            id: 'AUTH-SETTLED-001',
            supplementary_data: { related_ids: { order_id: 'ORD-SETTLED-001' } },
          },
        });

      expect(res.status).toBe(200);
      const paymentAfter = getPaymentById(payment.id);
      // Status MUST remain CAPTURED
      expect(paymentAfter?.status).toBe('CAPTURED');
      // Audit trail should record rejected transition attempt
      const rejectedLog = paymentAfter?.auditTrail.find(
        (a) => a.action === 'INVALID_TRANSITION_REJECTED'
      );
      expect(rejectedLog).toBeDefined();
    });

    it('STRICTLY PREVENTS voiding an already CAPTURED payment', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const payment = createPaymentRecord({
        milestoneId: 'ms-001',
        milestoneTitle: 'UI Architecture',
        projectId: 'prj-001',
        projectName: 'Web App',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-NO-VOID-001',
      });
      payment.status = 'CAPTURED';
      payment.paypalAuthorizationId = 'AUTH-NO-VOID-001';

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-VOID-CAPTURED',
          event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
          resource: {
            id: 'AUTH-NO-VOID-001',
          },
        });

      expect(res.status).toBe(200);
      const paymentAfter = getPaymentById(payment.id);
      expect(paymentAfter?.status).toBe('CAPTURED');
    });

    it('STRICTLY PREVENTS capturing a VOIDED payment', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const payment = createPaymentRecord({
        milestoneId: 'ms-001',
        milestoneTitle: 'UI Architecture',
        projectId: 'prj-001',
        projectName: 'Web App',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-NO-CAP-001',
      });
      payment.status = 'VOIDED';
      payment.paypalAuthorizationId = 'AUTH-NO-CAP-001';

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-CAP-VOIDED',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: 'CAP-NO-OP-001',
            parent_payment: 'AUTH-NO-CAP-001',
          },
        });

      expect(res.status).toBe(200);
      const paymentAfter = getPaymentById(payment.id);
      expect(paymentAfter?.status).toBe('VOIDED');
    });
  });

  // ── 8. Unsupported Event Types ────────────────────────────────────

  describe('Unsupported Event Handling', () => {
    it('returns HTTP 200 with status "ignored" for unsupported event types', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set(validHeaders)
        .send({
          id: 'WH-EVT-UNKNOWN-001',
          event_type: 'BILLING.SUBSCRIPTION.CREATED',
          resource: { id: 'SUB-123' },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ignored');
      expect(res.body.message).toMatch(/acknowledged and ignored/i);
    });
  });

  // ── 9. Middleware Ordering & Authentication Exemption Regression Tests ──

  describe('Middleware Ordering & Authentication Exemption (Bug Regression)', () => {
    it('proves POST /api/webhooks/paypal does NOT require user JWT and reaches webhook handler when posting {}', async () => {
      // Simulates real ngrok POST {} without Authorization header
      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set('x-test-no-auth', 'true') // Disables test-suite auth auto-injection
        .send({});

      // Must be rejected by the webhook handler for missing PayPal headers, NOT by requireAuth with 401
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('MISSING_TRANSMISSION_HEADERS');
      expect(res.body.message).not.toMatch(/Authentication required/i);
    });

    it('proves validly signed events can reach the webhook handler without a user JWT', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'SUCCESS',
      });

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set('x-test-no-auth', 'true') // No user JWT
        .set(validHeaders)
        .send({
          id: 'WH-EVT-NO-JWT-001',
          event_type: 'CHECKOUT.ORDER.APPROVED',
          resource: { id: 'ORD-NO-JWT' },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toMatch(/successfully processed/i);
    });

    it('proves invalid PayPal signatures are rejected without user JWT and without side effects', async () => {
      vi.spyOn(paypalClient, 'verifyWebhookSignature').mockResolvedValueOnce({
        verificationStatus: 'FAILURE',
      });

      const res = await request(app)
        .post('/api/webhooks/paypal')
        .set('x-test-no-auth', 'true') // No user JWT
        .set(validHeaders)
        .send({
          id: 'WH-EVT-BAD-SIG-001',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: 'CAP-BAD-SIG' },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SIGNATURE_VERIFICATION_FAILED');
    });

    it('proves other protected API endpoints STILL require authentication', async () => {
      // 1. GET /api/contracts requires auth
      const resContracts = await request(app)
        .get('/api/contracts')
        .set('x-test-no-auth', 'true');
      expect(resContracts.status).toBe(401);
      expect(resContracts.body.message).toMatch(/Authentication required/i);

      // 2. GET /api/users/me requires auth
      const resUsers = await request(app)
        .get('/api/users/me')
        .set('x-test-no-auth', 'true');
      expect(resUsers.status).toBe(401);
      expect(resUsers.body.message).toMatch(/Authentication required/i);

      // 3. POST /api/milestones/ms-001/paypal/order requires auth
      const resPaypal = await request(app)
        .post('/api/milestones/ms-001/paypal/order')
        .set('x-test-no-auth', 'true')
        .send({});
      expect(resPaypal.status).toBe(401);
      expect(resPaypal.body.message).toMatch(/Authentication required/i);
    });

    it('STRICTLY PREVENTS auth bypass via query string: /api/contracts?next=/webhooks/paypal requires auth', async () => {
      const res = await request(app)
        .get('/api/contracts?next=/webhooks/paypal')
        .set('x-test-no-auth', 'true');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('STRICTLY PREVENTS auth bypass via path traversal: /api/contracts/webhooks/paypal requires auth', async () => {
      const res = await request(app)
        .get('/api/contracts/webhooks/paypal')
        .set('x-test-no-auth', 'true');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('STRICTLY PREVENTS path-suffix confusion: /api/webhooks/paypal-extra does not hit webhook handler and cannot bypass auth', async () => {
      const res = await request(app)
        .post('/api/webhooks/paypal-extra')
        .set('x-test-no-auth', 'true')
        .send({});
      // Must not be treated as a webhook; unknown route returns 404 Not Found
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });
  });
});
