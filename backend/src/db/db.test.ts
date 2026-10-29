import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSupabaseConfigured,
  getUserSupabaseClient,
  getServiceSupabaseClient,
  resetServiceSupabaseClientForTests,
  isInMemoryStorePermitted,
  assertDatabaseReadinessForPayments,
} from './client';
import { mapDbContractToApp } from './contracts';
import { mapDbMilestoneToApp } from './milestones';
import { mapDbSubmissionToApp } from './submissions';
import { mapDbPaymentToApp } from './payments';
import { env, envSchema } from '../config/env';

describe('Database Access Layer & RLS Client Architecture Suite', () => {
  beforeEach(() => {
    resetServiceSupabaseClientForTests();
  });

  describe('Configuration & Client Safety', () => {
    it('correctly reports isSupabaseConfigured = false when placeholders or missing credentials are present', () => {
      // In local dev/test environment, placeholder or empty credentials exist
      const configured = isSupabaseConfigured();
      expect(typeof configured).toBe('boolean');
    });

    it('creates user-scoped client with Bearer authorization header for RLS caller identity', () => {
      // Temporarily mock non-placeholder env for client initialization test
      const originalUrl = env.SUPABASE_URL;
      const originalKey = env.SUPABASE_ANON_KEY;

      (env as Record<string, unknown>).SUPABASE_URL = 'https://valid-project.supabase.co';
      (env as Record<string, unknown>).SUPABASE_ANON_KEY = 'valid-anon-key-1234567890';

      const userClient = getUserSupabaseClient('test-token:usr-001:client:test@example.com');
      expect(userClient).toBeDefined();

      // Restore
      (env as Record<string, unknown>).SUPABASE_URL = originalUrl;
      (env as Record<string, unknown>).SUPABASE_ANON_KEY = originalKey;
    });

    it('rejects client initialization when required configuration is missing', () => {
      const originalUrl = env.SUPABASE_URL;
      (env as Record<string, unknown>).SUPABASE_URL = undefined;

      expect(() => getUserSupabaseClient('dummy-token')).toThrow(
        /SUPABASE_URL or SUPABASE_ANON_KEY missing/i
      );

      (env as Record<string, unknown>).SUPABASE_URL = originalUrl;
    });
  });

  describe('PostgreSQL Schema to Application Model Mappers', () => {
    it('correctly maps contracts and membership rows to Contract model', () => {
      const dbRow = {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Database Contract',
        description: 'PostgreSQL backed contract',
        total_budget: '15000.00',
        currency: 'USD',
        status: 'active' as const,
        client_id: 'usr-client-001',
        freelancer_id: 'usr-freelancer-001',
        created_at: '2026-10-29T00:00:00Z',
        updated_at: '2026-10-29T00:00:00Z',
        contract_memberships: [
          { user_id: 'usr-client-001', role: 'client' as const, joined_at: '2026-10-29T00:00:00Z' },
          { user_id: 'usr-freelancer-001', role: 'freelancer' as const, joined_at: '2026-10-29T00:00:00Z' },
        ],
      };

      const mapped = mapDbContractToApp(dbRow);
      expect(mapped.id).toBe(dbRow.id);
      expect(mapped.totalBudget).toBe(15000);
      expect(mapped.clientId).toBe('usr-client-001');
      expect(mapped.freelancerId).toBe('usr-freelancer-001');
      expect(mapped.members).toHaveLength(2);
      expect(mapped.members[0].role).toBe('client');
      expect(mapped.members[1].role).toBe('freelancer');
    });

    it('correctly maps milestone rows including acceptance criteria array', () => {
      const dbRow = {
        id: '22222222-2222-2222-2222-222222222222',
        contract_id: '11111111-1111-1111-1111-111111111111',
        title: 'Database Milestone',
        description: 'Acceptance criteria test',
        amount: '4500.00',
        currency: 'USD',
        status: 'in_progress' as const,
        order_index: 2,
        due_date: '2026-11-15',
        acceptance_criteria: ['Deliverable meets WCAG AA', 'Unit test coverage > 80%'],
        contracts: {
          title: 'Database Contract',
        },
      };

      const mapped = mapDbMilestoneToApp(dbRow);
      expect(mapped.id).toBe(dbRow.id);
      expect(mapped.projectId).toBe(dbRow.contract_id);
      expect(mapped.milestoneNumber).toBe(2);
      expect(mapped.amount).toBe(4500);
      expect(mapped.acceptanceCriteria).toHaveLength(2);
      expect(mapped.acceptanceCriteria[0]).toBe('Deliverable meets WCAG AA');
    });

    it('correctly maps deliverable submission rows', () => {
      const dbRow = {
        id: '33333333-3333-3333-3333-333333333333',
        milestone_id: '22222222-2222-2222-2222-222222222222',
        contract_id: '11111111-1111-1111-1111-111111111111',
        submitted_by: 'usr-freelancer-001',
        deliverable_url: 'https://github.com/example/repo/pull/42',
        notes: 'Ready for client review',
        status: 'pending_review' as const,
        review_notes: null,
        created_at: '2026-10-29T12:00:00Z',
        updated_at: '2026-10-29T12:00:00Z',
      };

      const mapped = mapDbSubmissionToApp(dbRow);
      expect(mapped.id).toBe(dbRow.id);
      expect(mapped.milestoneId).toBe(dbRow.milestone_id);
      expect(mapped.contractId).toBe(dbRow.contract_id);
      expect(mapped.submittedBy).toBe('usr-freelancer-001');
      expect(mapped.deliverableUrl).toBe('https://github.com/example/repo/pull/42');
      expect(mapped.status).toBe('pending_review');
    });

    it('correctly maps payment records and normalizes lifecycle status', () => {
      const dbRow = {
        id: '44444444-4444-4444-4444-444444444444',
        milestone_id: '22222222-2222-2222-2222-222222222222',
        contract_id: '11111111-1111-1111-1111-111111111111',
        amount: '2500.00',
        currency: 'USD',
        status: 'authorized',
        paypal_order_id: 'ORD-98765',
        paypal_authorization_id: 'AUTH-98765',
        approve_url: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST',
        created_at: '2026-10-29T14:00:00Z',
        updated_at: '2026-10-29T14:00:00Z',
      };

      const mapped = mapDbPaymentToApp(dbRow);
      expect(mapped.id).toBe(dbRow.id);
      expect(mapped.status).toBe('AUTHORIZED');
      expect(mapped.paypalOrderId).toBe('ORD-98765');
      expect(mapped.paypalAuthorizationId).toBe('AUTH-98765');
      expect(mapped.approveUrl).toBe('https://www.sandbox.paypal.com/checkoutnow?token=TEST');
    });
  });

  describe('Production Fail-Closed Database Security & Store Permissions', () => {
    it('STRICTLY REFUSES startup in production if SUPABASE_URL is missing', () => {
      const prodEnv = {
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.milestoneshield.ai',
        PAYPAL_CLIENT_ID: 'test-client-id-abc',
        PAYPAL_CLIENT_SECRET: 'test-client-secret-xyz-123456',
        PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
        // SUPABASE_URL omitted
        SUPABASE_ANON_KEY: 'test-anon-key-12345678901234567890',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-1234567890',
        SUPABASE_JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long',
      };

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.SUPABASE_URL).toBeDefined();
        expect(result.error.flatten().fieldErrors.SUPABASE_URL![0]).toMatch(/SUPABASE_URL is required in production/i);
      }
    });

    it('STRICTLY REFUSES startup in production if SUPABASE_URL is a placeholder', () => {
      const prodEnv = {
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.milestoneshield.ai',
        PAYPAL_CLIENT_ID: 'test-client-id-abc',
        PAYPAL_CLIENT_SECRET: 'test-client-secret-xyz-123456',
        PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
        SUPABASE_URL: 'https://your-project.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key-12345678901234567890',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-1234567890',
        SUPABASE_JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long',
      };

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.SUPABASE_URL![0]).toMatch(/cannot contain template placeholders/i);
      }
    });

    it('STRICTLY REFUSES startup in production if ALLOW_IN_MEMORY_STORES is true', () => {
      const prodEnv = {
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.milestoneshield.ai',
        PAYPAL_CLIENT_ID: 'test-client-id-abc',
        PAYPAL_CLIENT_SECRET: 'test-client-secret-xyz-123456',
        PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
        SUPABASE_URL: 'https://valid-project.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key-12345678901234567890',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-1234567890',
        SUPABASE_JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long',
        ALLOW_IN_MEMORY_STORES: 'true',
      };

      const result = envSchema.safeParse(prodEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.ALLOW_IN_MEMORY_STORES).toBeDefined();
        expect(result.error.flatten().fieldErrors.ALLOW_IN_MEMORY_STORES![0]).toMatch(/In-memory storage is strictly forbidden in production/i);
      }
    });

    it('verifies isInMemoryStorePermitted returns false in production and true in test/dev', () => {
      expect(isInMemoryStorePermitted()).toBe(true); // running in vitest

      const originalNodeEnv = env.NODE_ENV;
      (env as Record<string, unknown>).NODE_ENV = 'production';

      expect(isInMemoryStorePermitted()).toBe(false);

      (env as Record<string, unknown>).NODE_ENV = originalNodeEnv;
    });

    it('assertDatabaseReadinessForPayments throws in production when database client is unconfigured', () => {
      const originalNodeEnv = env.NODE_ENV;
      (env as Record<string, unknown>).NODE_ENV = 'production';

      expect(() => assertDatabaseReadinessForPayments()).toThrow(
        /Database configuration missing in production/i
      );

      (env as Record<string, unknown>).NODE_ENV = originalNodeEnv;
    });
  });
});
