import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpendingLimitService,
  SpendingLimitError,
  DEFAULT_CLAUDE_PRICING,
} from './spendingLimitService';

describe('Phase 5: Spending Limits & AI Budget Guard Service', () => {
  let service: SpendingLimitService;

  beforeEach(() => {
    service = new SpendingLimitService({
      maxCostPerRequestUsd: 0.10, // $0.10 max per call for tests
      maxDailyPerUserUsd: 0.50,   // $0.50 daily per user
      maxDailyAggregateUsd: 2.00, // $2.00 daily platform
      maxMonthlyAggregateUsd: 10.0,
      maxConcurrentRequests: 2,   // 2 concurrent max
      maxMilestoneAmountUsd: 50000.0,
    });
    service.resetStoreForTests();
  });

  describe('Token Cost Estimation', () => {
    it('accurately computes cost for Claude 3.5 Sonnet pricing model', () => {
      // 100,000 input tokens ($3/M) = $0.30
      // 20,000 output tokens ($15/M) = $0.30
      // Total = $0.60
      const cost = service.estimateCost(100_000, 20_000, DEFAULT_CLAUDE_PRICING);
      expect(cost).toBe(0.60);
    });
  });

  describe('Milestone Financial Hard Cap', () => {
    it('accepts milestones within the $50,000 platform limit', () => {
      expect(() => service.validateMilestoneAmount(2500)).not.toThrow();
      expect(() => service.validateMilestoneAmount(50000)).not.toThrow();
    });

    it('strictly rejects milestones exceeding the $50,000 platform hard cap', () => {
      expect(() => service.validateMilestoneAmount(50001)).toThrowError(
        /exceeds the platform authorization hard cap of \$50000.00/,
      );
    });

    it('rejects negative or zero milestone amounts', () => {
      expect(() => service.validateMilestoneAmount(0)).toThrowError(SpendingLimitError);
      expect(() => service.validateMilestoneAmount(-500)).toThrowError(SpendingLimitError);
    });
  });

  describe('Single-Request Cost Cap Guard', () => {
    it('approves requests within the single-call cap', () => {
      // 10,000 in, 2,000 out = (10k*3 + 2k*15)/1M = (0.03 + 0.03) = $0.06 < $0.10
      const check = service.checkBudgetEligibility('usr-001', 10_000, 2_000);
      expect(check.estimatedCostUsd).toBe(0.06);
    });

    it('fails-closed when a single request exceeds max cost per call', () => {
      // 50,000 in, 10,000 out = $0.15 + $0.15 = $0.30 > $0.10
      expect(() =>
        service.checkBudgetEligibility('usr-001', 50_000, 10_000),
      ).toThrowError(/exceeds the single-request limit/);
    });
  });

  describe('Per-User Daily Budget Enforcement', () => {
    it('exhausts user daily budget and blocks subsequent AI calls with 429', () => {
      // Record 8 requests of $0.06 = $0.48
      for (let i = 0; i < 8; i++) {
        service.recordUsage({
          userId: 'usr-heavy-spender',
          modelId: 'claude-3-5-sonnet',
          inputTokens: 10_000,
          outputTokens: 2_000,
        });
      }

      // Next request of $0.06 would push total to $0.54 > $0.50
      expect(() =>
        service.checkBudgetEligibility('usr-heavy-spender', 10_000, 2_000),
      ).toThrowError(/User daily AI budget exhausted/);
    });

    it('allows a different user to proceed when another user is budget-exhausted', () => {
      // Exhaust user A
      for (let i = 0; i < 10; i++) {
        service.recordUsage({
          userId: 'usr-exhausted',
          modelId: 'claude-3-5-sonnet',
          inputTokens: 10_000,
          outputTokens: 2_000,
        });
      }

      // User B should still be allowed
      expect(() =>
        service.checkBudgetEligibility('usr-clean-slate', 10_000, 2_000),
      ).not.toThrow();
    });
  });

  describe('Concurrency & Replay Defense', () => {
    it('blocks requests when active concurrency limit is reached', () => {
      service.acquireSlot();
      service.acquireSlot();

      // Third acquire should fail (maxConcurrentRequests = 2)
      expect(() => service.acquireSlot()).toThrowError(/Concurrent AI request slot unavailable/);

      // Releasing slot enables subsequent request
      service.releaseSlot();
      expect(() => service.acquireSlot()).not.toThrow();
    });

    it('detects and rejects duplicate or replayed request IDs', () => {
      service.recordUsage({
        userId: 'usr-001',
        modelId: 'claude-3-5-sonnet',
        inputTokens: 1_000,
        outputTokens: 500,
        requestId: 'req-unique-999',
      });

      expect(() =>
        service.checkBudgetEligibility('usr-001', 1_000, 500, 'req-unique-999'),
      ).toThrowError(/Duplicate or replayed AI request detected/);
    });
  });

  describe('Privacy-Preserving Audit Ledger', () => {
    it('records token volumes and costs without storing prompt or deliverable text', () => {
      const record = service.recordUsage({
        userId: 'usr-001',
        modelId: 'claude-3-5-sonnet',
        inputTokens: 5_000,
        outputTokens: 1_000,
      });

      expect(record.userId).toBe('usr-001');
      expect(record.modelId).toBe('claude-3-5-sonnet');
      expect(record.estimatedCostUsd).toBe(0.03);
      expect((record as Record<string, unknown>).prompt).toBeUndefined();
      expect((record as Record<string, unknown>).deliverableContent).toBeUndefined();
    });
  });
});
