import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetContractsStoreForTests } from '../models/contracts';
import { resetProfilesStoreForTests } from '../routes/users';
import { resetPaymentStore, createPaymentRecord } from '../services/paymentStore';
import { resetMilestonesStore } from '../models/milestones';
import { env } from '../config/env';

describe('Phase 1: Multi-Tenant Data Isolation and Authorization Security', () => {
  const app = createApp();

  beforeEach(() => {
    resetContractsStoreForTests();
    resetProfilesStoreForTests();
    resetPaymentStore();
    resetMilestonesStore();
  });

  // ── 1. Unauthenticated Access Protection (HTTP 401) ─────────────────

  describe('Unauthenticated Request Guard', () => {
    it('rejects unauthenticated requests to /api/contracts with 401', async () => {
      const res = await request(app)
        .get('/api/contracts')
        .set('x-test-no-auth', 'true');

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('rejects requests with malformed Authorization header with 401', async () => {
      const res = await request(app)
        .get('/api/contracts')
        .set('Authorization', 'InvalidFormatHeader');

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Invalid Authorization header format/i);
    });

    it('rejects unauthenticated requests to /api/users/me with 401', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('x-test-no-auth', 'true');

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('rejects unauthenticated requests to capture payment with 401', async () => {
      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-001/capture')
        .set('x-test-no-auth', 'true')
        .send({ confirmed: true });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });

  // ── 2. Multi-Tenant Contract Isolation (HTTP 403) ───────────────────

  describe('Contract Isolation (User A vs User B)', () => {
    // User A: usr-client-001 (Member of proj-001)
    // User B: usr-client-002 (Member of proj-002)

    it("allows User A to view their own contract proj-001", async () => {
      const res = await request(app)
        .get('/api/contracts/proj-001')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe('proj-001');
    });

    it("STRICTLY FORBIDS User A from reading User B's contract proj-002 (403)", async () => {
      const res = await request(app)
        .get('/api/contracts/proj-002')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com');

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/not an authorized member/i);
    });

    it("STRICTLY FORBIDS User B from reading User A's contract proj-001 (403)", async () => {
      const res = await request(app)
        .get('/api/contracts/proj-001')
        .set('Authorization', 'Bearer test-token:usr-client-002:client:bob@example.com');

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/not an authorized member/i);
    });

    it("scopes GET /api/contracts to only contracts where the user is an active member", async () => {
      // User A
      const resA = await request(app)
        .get('/api/contracts')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com');

      expect(resA.status).toBe(200);
      expect(resA.body.data).toHaveLength(1);
      expect(resA.body.data[0].id).toBe('proj-001');

      // User B
      const resB = await request(app)
        .get('/api/contracts')
        .set('Authorization', 'Bearer test-token:usr-client-002:client:bob@example.com');

      expect(resB.status).toBe(200);
      expect(resB.body.data).toHaveLength(1);
      expect(resB.body.data[0].id).toBe('proj-002');
    });
  });

  // ── 3. Role-Based Access Control (Client vs Freelancer) ──────────────

  describe('Role-Based Access Control', () => {
    it('forbids freelancer from creating new contracts (403)', async () => {
      const res = await request(app)
        .post('/api/contracts')
        .set('Authorization', 'Bearer test-token:usr-freelancer-001:freelancer:samira@example.com')
        .send({
          title: 'Unauthorized Contract Attempt',
          totalBudget: 5000,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/requires one of \[client, admin\] roles/i);
    });

    it('allows client to create new contracts (201)', async () => {
      const res = await request(app)
        .post('/api/contracts')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com')
        .send({
          title: 'New Mobile App Prototype',
          totalBudget: 8000,
          currency: 'USD',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.title).toBe('New Mobile App Prototype');
    });

    it('forbids freelancer from capturing milestone funds (403)', async () => {
      // Create a test payment record for ms-002 on proj-001
      createPaymentRecord({
        milestoneId: 'ms-002',
        milestoneTitle: 'Core Frontend',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform',
        amount: 3500,
        currency: 'USD',
        paypalOrderId: 'TEST-ORDER-FREE-01',
      });

      const res = await request(app)
        .post('/api/payments/paypal/authorizations/AUTH-SAMPLE-01/capture')
        .set('Authorization', 'Bearer test-token:usr-freelancer-001:freelancer:samira@example.com')
        .send({ confirmed: true });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/requires one of \[client, admin\] roles/i);
    });
  });

  // ── 4. Payment Scoping & Financial Isolation ─────────────────────────

  describe('Payment Scoping & Financial Isolation', () => {
    it("prevents User B from viewing User A's payment record (403)", async () => {
      createPaymentRecord({
        milestoneId: 'ms-001',
        milestoneTitle: 'Design System',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform',
        amount: 3000,
        currency: 'USD',
        paypalOrderId: 'ORDER-USER-A-01',
      });

      // User B tries to view payment for ms-001 (which belongs to proj-001)
      const res = await request(app)
        .get('/api/payments/paypal/milestone/ms-001')
        .set('Authorization', 'Bearer test-token:usr-client-002:client:bob@example.com');

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it("scopes GET /api/payments/paypal so User A only sees their own contract payments", async () => {
      // Payment on proj-001 (User A's contract)
      createPaymentRecord({
        milestoneId: 'ms-001',
        milestoneTitle: 'Design System',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform',
        amount: 3000,
        currency: 'USD',
        paypalOrderId: 'ORDER-PROJ-001',
      });

      // Payment on proj-002 (User B's contract)
      createPaymentRecord({
        milestoneId: 'ms-002',
        milestoneTitle: 'Brand Identity',
        projectId: 'proj-002',
        projectName: 'Brand Identity Project',
        amount: 4000,
        currency: 'USD',
        paypalOrderId: 'ORDER-PROJ-002',
      });

      const res = await request(app)
        .get('/api/payments/paypal')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com');

      expect(res.status).toBe(200);
      expect(res.body.data.payments).toHaveLength(1);
      expect(res.body.data.payments[0].projectId).toBe('proj-001');
    });
  });

  // ── 5. Safe Account Deletion & Retention Compliance ──────────────────

  describe('Account Lifecycle & Safe Deletion', () => {
    it('requires exact confirmation text to delete account', async () => {
      const res = await request(app)
        .delete('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com')
        .send({ confirmation: 'please delete me' });

      expect(res.status).toBe(400);
    });

    it('anonymizes personal profile data upon valid account deletion', async () => {
      const res = await request(app)
        .delete('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com')
        .send({
          confirmation: 'DELETE MY ACCOUNT',
          reason: 'Switching to another workspace',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Account successfully closed/i);
      expect(res.body.message).toMatch(/anonymized/i);

      // Verify profile is now anonymized
      const profileRes = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com');

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.data.fullName).toBe('Anonymized Former User');
      expect(profileRes.body.data.email).toContain('anonymized-');
    });
  });

  // ── 6. Security Hardening Regression Tests ─────────────────────────

  describe('Security Hardening & Production Safeguards', () => {
    const originalNodeEnv = env.NODE_ENV;

    afterEach(() => {
      env.NODE_ENV = originalNodeEnv;
    });

    it('STRICTLY rejects test-token: in production environment (HTTP 401)', async () => {
      env.NODE_ENV = 'production';

      const res = await request(app)
        .get('/api/contracts')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com');

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/strictly forbidden in production/i);
    });

    it('STRICTLY rejects dev-token: in production environment (HTTP 401)', async () => {
      env.NODE_ENV = 'production';

      const res = await request(app)
        .get('/api/contracts')
        .set('Authorization', 'Bearer dev-token:usr-client-001:client');

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/strictly forbidden in production/i);
    });

    it('rejects unverified users from accessing protected data (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/contracts')
        .set('Authorization', 'Bearer test-token:usr-unverified-01:client:unverified@example.com:unverified');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Email verification required/i);
    });

    it('sanitizes untrusted role selection attempting admin escalation to client', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-attacker:admin:attacker@example.com:untrusted_metadata');

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('client'); // Sanitized to client, NOT admin
    });

    it('forbids freelancer from authorizing PayPal orders (HTTP 403)', async () => {
      createPaymentRecord({
        milestoneId: 'ms-003',
        milestoneTitle: 'PayPal Sandbox Integration',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform',
        amount: 2500,
        currency: 'USD',
        paypalOrderId: 'ORD-FREELANCER-AUTH-FAIL',
      });

      const res = await request(app)
        .post('/api/payments/paypal/orders/ORD-FREELANCER-AUTH-FAIL/authorize')
        .set('Authorization', 'Bearer test-token:usr-freelancer-001:freelancer:samira@example.com')
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/requires one of \[client, admin\] roles/i);
    });
  });
});
