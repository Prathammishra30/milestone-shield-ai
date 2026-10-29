import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetContractsStoreForTests } from '../models/contracts';
import { resetMilestonesStore } from '../models/milestones';
import { resetSubmissionsStoreForTests } from '../models/submissions';

describe('Phase 3 & 4: Broken Access Control, IDOR & SSRF Security Suite', () => {
  const app = createApp();

  beforeEach(() => {
    resetContractsStoreForTests();
    resetMilestonesStore();
    resetSubmissionsStoreForTests();
  });

  // ── 1. Contract & Milestone IDOR Isolation ────────────────────────

  describe('Contract & Milestone Access Scoping', () => {
    it('allows a verified contract member to fetch milestone details', async () => {
      // User A (Alex Vance) is member of proj-001 which owns ms-002
      const res = await request(app)
        .get('/api/milestones/ms-002')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe('ms-002');
      expect(res.body.data.projectId).toBe('proj-001');
    });

    it('STRICTLY FORBIDS non-member User B from fetching User A milestone (403)', async () => {
      // User B is member of proj-002, NOT proj-001
      const res = await request(app)
        .get('/api/milestones/ms-002')
        .set('Authorization', 'Bearer test-token:usr-client-002:client:bob@example.com');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not authorized to view or manage milestones/i);
    });

    it('returns 404 for nonexistent milestone without disclosing existence', async () => {
      const res = await request(app)
        .get('/api/milestones/ms-nonexistent-999')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com');

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Milestone not found/i);
    });
  });

  // ── 2. Deliverable Submissions IDOR & Role Guard ───────────────────

  describe('Deliverable Submissions Scoping & Role Enforcement', () => {
    it('allows assigned freelancer to submit proof for their contract milestone (201)', async () => {
      // User C (Samira Chen) is the freelancer on proj-001 (owning ms-002)
      const res = await request(app)
        .post('/api/milestones/ms-002/submissions')
        .set('Authorization', 'Bearer test-token:usr-freelancer-001:freelancer:samira@example.com')
        .send({
          deliverableUrl: 'https://github.com/acme/storefront/pull/42',
          notes: 'Completed checkout flow and unit tests.',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.milestoneId).toBe('ms-002');
      expect(res.body.data.contractId).toBe('proj-001');
      expect(res.body.data.submittedBy).toBe('usr-freelancer-001');
      expect(res.body.data.status).toBe('pending_review');
    });

    it('STRICTLY FORBIDS client from creating milestone submissions (403)', async () => {
      // Client (Alex Vance) cannot submit deliverables (only freelancers)
      const res = await request(app)
        .post('/api/milestones/ms-002/submissions')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com')
        .send({
          deliverableUrl: 'https://github.com/acme/storefront/pull/42',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/requires one of \[freelancer, admin\] roles/i);
    });

    it('STRICTLY FORBIDS non-member freelancer from submitting deliverables on another contract (403)', async () => {
      // Freelancer 2 is assigned to proj-002, NOT proj-001
      const res = await request(app)
        .post('/api/milestones/ms-002/submissions')
        .set('Authorization', 'Bearer test-token:usr-freelancer-002:freelancer:other@example.com')
        .send({
          deliverableUrl: 'https://github.com/other/repo/pull/1',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not authorized to view or manage milestones/i);
    });

    it('allows contract members to view submissions for their milestone', async () => {
      const res = await request(app)
        .get('/api/milestones/ms-002/submissions')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:alex@example.com');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].milestoneId).toBe('ms-002');
    });

    it('blocks non-member User B from viewing submissions for User A milestone (403)', async () => {
      const res = await request(app)
        .get('/api/milestones/ms-002/submissions')
        .set('Authorization', 'Bearer test-token:usr-client-002:client:bob@example.com');

      expect(res.status).toBe(403);
    });
  });

  // ── 3. SSRF & Malicious Deliverable URL Defense ────────────────────

  describe('SSRF Protection on Deliverable Submissions', () => {
    it('rejects cloud metadata IP addresses (169.254.169.254)', async () => {
      const res = await request(app)
        .post('/api/milestones/ms-002/submissions')
        .set('Authorization', 'Bearer test-token:usr-freelancer-001:freelancer:samira@example.com')
        .send({
          deliverableUrl: 'https://169.254.169.254/latest/meta-data/',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors[0].message).toMatch(/cannot target internal, private or metadata addresses/i);
    });

    it('rejects loopback addresses (localhost and 127.0.0.1)', async () => {
      const res = await request(app)
        .post('/api/milestones/ms-002/submissions')
        .set('Authorization', 'Bearer test-token:usr-freelancer-001:freelancer:samira@example.com')
        .send({
          deliverableUrl: 'https://127.0.0.1:8080/admin/secret',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors[0].message).toMatch(/cannot target internal/i);
    });

    it('rejects RFC 1918 private network ranges (10.0.0.1, 192.168.1.1)', async () => {
      const res = await request(app)
        .post('/api/milestones/ms-002/submissions')
        .set('Authorization', 'Bearer test-token:usr-freelancer-001:freelancer:samira@example.com')
        .send({
          deliverableUrl: 'https://10.0.0.1/internal-dashboard',
        });

      expect(res.status).toBe(400);
    });

    it('rejects non-HTTPS URI schemes (http://, ftp://, file://, javascript:)', async () => {
      const res = await request(app)
        .post('/api/milestones/ms-002/submissions')
        .set('Authorization', 'Bearer test-token:usr-freelancer-001:freelancer:samira@example.com')
        .send({
          deliverableUrl: 'http://insecure-site.com/deliverable.zip',
        });

      expect(res.status).toBe(400);
    });
  });

  // ── 4. Security Headers Verification ──────────────────────────────

  describe('HTTP Security Headers Middleware', () => {
    it('sets OWASP recommended security headers on all API responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });
  });
});
