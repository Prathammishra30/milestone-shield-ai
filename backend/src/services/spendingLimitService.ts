/**
 * Application-Level Spending Limit & AI Budget Guard Service
 *
 * CRITICAL SAFETY RULES:
 * 1. Fail-Closed: If budget limits are exceeded or missing, requests are strictly rejected.
 * 2. Privacy-Preserving Ledger: Records token counts and dollar estimations without storing
 *    prompts, deliverable text, or personal PII.
 * 3. Concurrency & Rate Throttling: Prevents race conditions and denial-of-wallet exhaustion.
 * 4. Milestone Financial Hard Cap: Enforces max transaction amounts on server milestones.
 *
 * NOTE: Application controls enforce local software spend guards; they do not replace
 * provider-level billing hard limits in the Anthropic / PayPal developer console.
 */

export class SpendingLimitError extends Error {
  public readonly code:
    | 'CONCURRENCY_EXCEEDED'
    | 'REQUEST_COST_EXCEEDED'
    | 'USER_DAILY_EXCEEDED'
    | 'PLATFORM_DAILY_EXCEEDED'
    | 'PLATFORM_MONTHLY_EXCEEDED'
    | 'MILESTONE_AMOUNT_EXCEEDED';
  public readonly statusCode: number;

  constructor(
    code: SpendingLimitError['code'],
    message: string,
    statusCode = 429,
  ) {
    super(message);
    this.name = 'SpendingLimitError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, SpendingLimitError.prototype);
  }
}

export interface SpendingLimitsConfig {
  maxCostPerRequestUsd: number; // Max estimated cost for a single invocation (e.g. $0.50)
  maxDailyPerUserUsd: number; // Max total daily cost per user ID (e.g. $5.00)
  maxDailyAggregateUsd: number; // Max total platform daily cost across all users (e.g. $50.00)
  maxMonthlyAggregateUsd: number; // Max total platform monthly cost (e.g. $500.00)
  maxConcurrentRequests: number; // Max simultaneous active AI requests (e.g. 5)
  maxMilestoneAmountUsd: number; // Max single milestone financial cap (e.g. $50,000.00)
}

export interface ModelPricing {
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
}

// Canonical Claude 3.5 Sonnet pricing (USD per 1M tokens)
export const DEFAULT_CLAUDE_PRICING: ModelPricing = {
  inputPerMillionTokens: 3.0,
  outputPerMillionTokens: 15.0,
};

export interface AiUsageRecord {
  id: string;
  timestamp: string;
  userId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  requestId?: string;
}

export class SpendingLimitService {
  private config: SpendingLimitsConfig;
  private activeConcurrency = 0;
  private userDailySpend = new Map<string, { date: string; amountUsd: number }>();
  private aggregateDailySpend = { date: '', amountUsd: 0 };
  private aggregateMonthlySpend = { month: '', amountUsd: 0 };
  private usageLedger: AiUsageRecord[] = [];
  private processedRequestIds = new Set<string>();

  constructor(config?: Partial<SpendingLimitsConfig>) {
    this.config = {
      maxCostPerRequestUsd: 0.5,
      maxDailyPerUserUsd: 5.0,
      maxDailyAggregateUsd: 50.0,
      maxMonthlyAggregateUsd: 500.0,
      maxConcurrentRequests: 5,
      maxMilestoneAmountUsd: 50000.0,
      ...config,
    };
  }

  private getTodayString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getCurrentMonthString(): string {
    return new Date().toISOString().slice(0, 7);
  }

  /**
   * Calculates estimated cost in USD for a given token volume
   */
  public estimateCost(
    inputTokens: number,
    outputTokens: number,
    pricing: ModelPricing = DEFAULT_CLAUDE_PRICING,
  ): number {
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillionTokens;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillionTokens;
    return Number((inputCost + outputCost).toFixed(6));
  }

  /**
   * Validates milestone authorization amount against trusted financial hard caps
   */
  public validateMilestoneAmount(amount: number): void {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new SpendingLimitError(
        'MILESTONE_AMOUNT_EXCEEDED',
        'Milestone amount must be a positive number greater than 0.',
        400,
      );
    }

    if (amount > this.config.maxMilestoneAmountUsd) {
      throw new SpendingLimitError(
        'MILESTONE_AMOUNT_EXCEEDED',
        `Milestone amount of $${amount.toFixed(2)} exceeds the platform authorization hard cap of $${this.config.maxMilestoneAmountUsd.toFixed(2)}.`,
        400,
      );
    }
  }

  /**
   * Pre-flight budget verification (Fail-closed).
   * Verifies request cost, per-user daily budget, aggregate budget, and concurrency.
   */
  public checkBudgetEligibility(
    userId: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    requestId?: string,
  ): { estimatedCostUsd: number } {
    if (requestId && this.processedRequestIds.has(requestId)) {
      throw new SpendingLimitError(
        'CONCURRENCY_EXCEEDED',
        `Duplicate or replayed AI request detected (ID: '${requestId}').`,
        409,
      );
    }

    // 1. Concurrency limit check
    if (this.activeConcurrency >= this.config.maxConcurrentRequests) {
      throw new SpendingLimitError(
        'CONCURRENCY_EXCEEDED',
        `System AI concurrency limit reached (${this.activeConcurrency}/${this.config.maxConcurrentRequests}). Please retry shortly.`,
        429,
      );
    }

    const estimatedCost = this.estimateCost(estimatedInputTokens, estimatedOutputTokens);

    // 2. Single request cost check
    if (estimatedCost > this.config.maxCostPerRequestUsd) {
      throw new SpendingLimitError(
        'REQUEST_COST_EXCEEDED',
        `Estimated request cost ($${estimatedCost.toFixed(4)}) exceeds the single-request limit of $${this.config.maxCostPerRequestUsd.toFixed(2)}.`,
        400,
      );
    }

    const today = this.getTodayString();
    const currentMonth = this.getCurrentMonthString();

    // 3. User daily budget check
    const userRecord = this.userDailySpend.get(userId);
    const currentUserSpend = userRecord && userRecord.date === today ? userRecord.amountUsd : 0;
    if (currentUserSpend + estimatedCost > this.config.maxDailyPerUserUsd) {
      throw new SpendingLimitError(
        'USER_DAILY_EXCEEDED',
        `User daily AI budget exhausted. Current spend: $${currentUserSpend.toFixed(2)} / $${this.config.maxDailyPerUserUsd.toFixed(2)}. Resets at 00:00 UTC.`,
        429,
      );
    }

    // 4. Platform daily aggregate budget check
    const currentDailyAgg = this.aggregateDailySpend.date === today ? this.aggregateDailySpend.amountUsd : 0;
    if (currentDailyAgg + estimatedCost > this.config.maxDailyAggregateUsd) {
      throw new SpendingLimitError(
        'PLATFORM_DAILY_EXCEEDED',
        'Platform daily AI budget cap reached. System is paused until 00:00 UTC.',
        429,
      );
    }

    // 5. Platform monthly aggregate budget check
    const currentMonthlyAgg = this.aggregateMonthlySpend.month === currentMonth ? this.aggregateMonthlySpend.amountUsd : 0;
    if (currentMonthlyAgg + estimatedCost > this.config.maxMonthlyAggregateUsd) {
      throw new SpendingLimitError(
        'PLATFORM_MONTHLY_EXCEEDED',
        'Platform monthly AI budget threshold exceeded. Commercial spending cap enforced.',
        429,
      );
    }

    return { estimatedCostUsd: estimatedCost };
  }

  /**
   * Acquire a concurrency slot when initiating an in-flight AI call
   */
  public acquireSlot(): void {
    if (this.activeConcurrency >= this.config.maxConcurrentRequests) {
      throw new SpendingLimitError(
        'CONCURRENCY_EXCEEDED',
        'Concurrent AI request slot unavailable.',
        429,
      );
    }
    this.activeConcurrency++;
  }

  /**
   * Release concurrency slot once AI invocation finishes or fails
   */
  public releaseSlot(): void {
    if (this.activeConcurrency > 0) {
      this.activeConcurrency--;
    }
  }

  /**
   * Commits actual usage after execution. Never stores prompts, deliverable bodies, or secrets.
   */
  public recordUsage(params: {
    userId: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    requestId?: string;
  }): AiUsageRecord {
    const cost = this.estimateCost(params.inputTokens, params.outputTokens);
    const today = this.getTodayString();
    const currentMonth = this.getCurrentMonthString();

    // Update user daily
    const userRecord = this.userDailySpend.get(params.userId);
    const prevUserSpend = userRecord && userRecord.date === today ? userRecord.amountUsd : 0;
    this.userDailySpend.set(params.userId, {
      date: today,
      amountUsd: Number((prevUserSpend + cost).toFixed(6)),
    });

    // Update aggregate daily
    const prevDaily = this.aggregateDailySpend.date === today ? this.aggregateDailySpend.amountUsd : 0;
    this.aggregateDailySpend = {
      date: today,
      amountUsd: Number((prevDaily + cost).toFixed(6)),
    };

    // Update aggregate monthly
    const prevMonthly = this.aggregateMonthlySpend.month === currentMonth ? this.aggregateMonthlySpend.amountUsd : 0;
    this.aggregateMonthlySpend = {
      month: currentMonth,
      amountUsd: Number((prevMonthly + cost).toFixed(6)),
    };

    if (params.requestId) {
      this.processedRequestIds.add(params.requestId);
    }

    const record: AiUsageRecord = {
      id: `ai-use-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: params.userId,
      modelId: params.modelId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCostUsd: cost,
      requestId: params.requestId,
    };

    this.usageLedger.push(record);
    return record;
  }

  public getSummaryForUser(userId: string): { dailySpendUsd: number; remainingUsd: number } {
    const today = this.getTodayString();
    const userRecord = this.userDailySpend.get(userId);
    const dailySpendUsd = userRecord && userRecord.date === today ? userRecord.amountUsd : 0;
    const remainingUsd = Math.max(0, this.config.maxDailyPerUserUsd - dailySpendUsd);
    return { dailySpendUsd, remainingUsd };
  }

  public resetStoreForTests(): void {
    this.activeConcurrency = 0;
    this.userDailySpend.clear();
    this.aggregateDailySpend = { date: '', amountUsd: 0 };
    this.aggregateMonthlySpend = { month: '', amountUsd: 0 };
    this.usageLedger = [];
    this.processedRequestIds.clear();
  }
}

export const spendingLimitService = new SpendingLimitService();
