import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetProfilesStoreForTests, getProfile, userAuditLog } from './users';

describe('User Lifecycle, Role Privilege Escalation & Authorization Suite', () => {
  const app = createApp();

  beforeEach(() => {
    resetProfilesStoreForTests();
  });

  describe('GET /api/users/me', () => {
    it('returns current profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:client@example.com');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.id).toBe('usr-client-001');
      expect(res.body.data.role).toBe('client');
      expect(res.body.data.email).toBe('client@example.com');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('x-test-no-auth', 'true');
      expect(res.status).toBe(401);
    });

    it('rejects unverified email addresses with 403', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-unverified:client:unverified@example.com:unverified');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Email verification required/i);
    });
  });

  describe('PATCH /api/users/me (Privilege Escalation & Field Immutability)', () => {
    it('allows valid profile name and avatar updates', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:client@example.com')
        .send({
          fullName: 'Alex Vance Updated',
          avatarUrl: 'https://example.com/avatar.png',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Alex Vance Updated');
      expect(res.body.data.avatarUrl).toBe('https://example.com/avatar.png');

      const saved = getProfile('usr-client-001');
      expect(saved?.fullName).toBe('Alex Vance Updated');
    });

    it('STRICTLY REJECTS attempts to modify role to admin (400)', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:client@example.com')
        .send({
          fullName: 'Alex Vance',
          role: 'admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');

      // Verify role was NOT escalated in store
      const profile = getProfile('usr-client-001');
      expect(profile?.role).toBe('client');
    });

    it('STRICTLY REJECTS attempts to modify user id or deletedAt (400)', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:client@example.com')
        .send({
          id: 'usr-overridden',
          deletedAt: new Date().toISOString(),
        });

      expect(res.status).toBe(400);

      // Verify target profile still has original ID
      const original = getProfile('usr-client-001');
      expect(original?.id).toBe('usr-client-001');
      expect(getProfile('usr-overridden')).toBeUndefined();
    });

    it('preserves multi-tenant isolation: User A cannot affect User B', async () => {
      // User A (client) updates profile
      await request(app)
        .patch('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:client@example.com')
        .send({
          fullName: 'User A Modified',
        });

      // Verify User B (freelancer) profile is untouched
      const profileB = getProfile('usr-freelancer-001');
      expect(profileB?.fullName).toBe('Samira Chen');
      expect(profileB?.role).toBe('freelancer');
    });
  });

  describe('POST /api/users/me/onboarding', () => {
    it('completes onboarding with valid role (freelancer)', async () => {
      const res = await request(app)
        .post('/api/users/me/onboarding')
        .set('Authorization', 'Bearer test-token:usr-new-001:freelancer:new@example.com')
        .send({
          role: 'freelancer',
          fullName: 'New Freelancer',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.onboardingCompleted).toBe(true);
      expect(res.body.data.role).toBe('freelancer');
    });

    it('STRICTLY REJECTS onboarding attempts requesting admin role (400)', async () => {
      const res = await request(app)
        .post('/api/users/me/onboarding')
        .set('Authorization', 'Bearer test-token:usr-new-002:client:new2@example.com')
        .send({
          role: 'admin',
          fullName: 'Sneaky Admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('DELETE /api/users/me (Account Deletion & Data Retention)', () => {
    it('rejects deletion without exact confirmation text (400)', async () => {
      const res = await request(app)
        .delete('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:client@example.com')
        .send({
          confirmation: 'delete my account', // lowercase should fail
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');

      // User profile remains intact
      const profile = getProfile('usr-client-001');
      expect(profile?.deletedAt).toBeUndefined();
    });

    it('safely anonymizes personal PII while preserving audit trail on valid deletion', async () => {
      const initialAuditCount = userAuditLog.length;

      const res = await request(app)
        .delete('/api/users/me')
        .set('Authorization', 'Bearer test-token:usr-client-001:client:client@example.com')
        .send({
          confirmation: 'DELETE MY ACCOUNT',
          reason: 'Testing GDPR / account closure compliance',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toMatch(/Personal profile data has been anonymized/i);

      // Verify PII is anonymized
      const anonymizedProfile = getProfile('usr-client-001');
      expect(anonymizedProfile).toBeDefined();
      expect(anonymizedProfile?.fullName).toBe('Anonymized Former User');
      expect(anonymizedProfile?.email).toContain('anonymized-usr-clie@deleted.milestoneshield.internal');
      expect(anonymizedProfile?.avatarUrl).toBeUndefined();
      expect(anonymizedProfile?.deletedAt).toBeDefined();

      // Verify audit log has the ACCOUNT_DELETED event
      expect(userAuditLog.length).toBeGreaterThan(initialAuditCount);
      const deleteLog = userAuditLog.find(
        (e) => e.entityId === 'usr-client-001' && e.action === 'ACCOUNT_DELETED'
      );
      expect(deleteLog).toBeDefined();
      expect(deleteLog?.actorId).toBe('usr-client-001');
    });
  });
});
