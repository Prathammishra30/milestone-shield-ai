/**
 * In-Memory Payment & Audit Event Store (Temporary / Development Mode)
 *
 * ============================================================================
 * IMPORTANT PERSISTENCE NOTICE:
 * This store is an IN-MEMORY implementation intended exclusively for prototype
 * demonstrations, automated testing, and development workflows in Milestone 2A.
 *
 * DATA STORED IN THIS MODULE DOES NOT SURVIVE PROCESS RESTARTS, SERVER CRASHES,
 * OR MULTI-INSTANCE CONTAINER DEPLOYMENTS.
 *
 * Future milestones (Milestone 3) will introduce a durable PostgreSQL persistence
 * layer with transaction management and schema migrations.
 * ============================================================================
 */

export type SandboxPaymentStatus =
  | 'ORDER_CREATED'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'VOIDED'
  | 'FAILED';

export interface AuditEvent {
  id: string;
  timestamp: string;
  action:
    | 'ORDER_CREATED'
    | 'BUYER_APPROVED'
    | 'AUTHORIZED'
    | 'CAPTURED'
    | 'VOIDED'
    | 'PAYMENT_FAILED'
    | 'DUPLICATE_CAPTURE_PREVENTED'
    | 'INVALID_TRANSITION_REJECTED';
  actor: 'client' | 'freelancer' | 'operator' | 'system';
  details: Record<string, unknown>;
  note?: string;
}

export interface TrackedPayment {
  id: string; // Internal unique reference, e.g. "pay-sbx-001"
  milestoneId: string;
  milestoneTitle: string;
  projectId: string;
  projectName: string;
  amount: number;
  currency: string;
  status: SandboxPaymentStatus;
  paypalOrderId: string;
  paypalAuthorizationId?: string;
  paypalCaptureId?: string;
  approveUrl?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  auditTrail: AuditEvent[];
}

export interface CreatePaymentInput {
  milestoneId: string;
  milestoneTitle: string;
  projectId: string;
  projectName: string;
  amount: number;
  currency: string;
  paypalOrderId: string;
  approveUrl?: string;
  idempotencyKey?: string;
  actor?: 'client' | 'operator' | 'system';
  note?: string;
}

// In-memory collection of tracked PayPal payments
let payments: Map<string, TrackedPayment> = new Map();
let counter = 1;

export function createPaymentRecord(input: CreatePaymentInput): TrackedPayment {
  const id = `pay-sbx-${String(counter++).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const initialAuditEvent: AuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    action: 'ORDER_CREATED',
    actor: input.actor ?? 'client',
    details: {
      paypalOrderId: input.paypalOrderId,
      amount: input.amount,
      currency: input.currency,
      milestoneId: input.milestoneId,
      intent: 'AUTHORIZE',
      isSandbox: true,
    },
    note: input.note ?? 'PayPal Orders v2 created with intent AUTHORIZE in Sandbox',
  };

  const record: TrackedPayment = {
    id,
    milestoneId: input.milestoneId,
    milestoneTitle: input.milestoneTitle,
    projectId: input.projectId,
    projectName: input.projectName,
    amount: input.amount,
    currency: input.currency,
    status: 'ORDER_CREATED',
    paypalOrderId: input.paypalOrderId,
    approveUrl: input.approveUrl,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
    auditTrail: [initialAuditEvent],
  };

  payments.set(id, record);
  return record;
}

export function getPaymentById(id: string): TrackedPayment | undefined {
  return payments.get(id);
}

export function getPaymentByOrderId(orderId: string): TrackedPayment | undefined {
  for (const payment of payments.values()) {
    if (payment.paypalOrderId === orderId) {
      return payment;
    }
  }
  return undefined;
}

export function getPaymentByAuthorizationId(authId: string): TrackedPayment | undefined {
  for (const payment of payments.values()) {
    if (payment.paypalAuthorizationId === authId) {
      return payment;
    }
  }
  return undefined;
}

export function getPaymentByCaptureId(captureId: string): TrackedPayment | undefined {
  for (const payment of payments.values()) {
    if (payment.paypalCaptureId === captureId) {
      return payment;
    }
  }
  return undefined;
}

export function getPaymentByMilestoneId(milestoneId: string): TrackedPayment | undefined {
  for (const payment of payments.values()) {
    if (payment.milestoneId === milestoneId) {
      return payment;
    }
  }
  return undefined;
}

export function listPayments(): TrackedPayment[] {
  return Array.from(payments.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function updatePaymentStatus(
  paymentId: string,
  newStatus: SandboxPaymentStatus,
  action: AuditEvent['action'],
  actor: AuditEvent['actor'],
  details: Record<string, unknown>,
  note?: string,
  extraFields?: Partial<Pick<TrackedPayment, 'paypalAuthorizationId' | 'paypalCaptureId'>>,
): TrackedPayment {
  const payment = payments.get(paymentId);
  if (!payment) {
    throw new Error(`Tracked payment '${paymentId}' not found in in-memory store`);
  }

  const now = new Date().toISOString();
  const auditEvent: AuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    action,
    actor,
    details,
    note,
  };

  payment.status = newStatus;
  payment.updatedAt = now;
  payment.auditTrail.push(auditEvent);

  if (extraFields?.paypalAuthorizationId) {
    payment.paypalAuthorizationId = extraFields.paypalAuthorizationId;
  }
  if (extraFields?.paypalCaptureId) {
    payment.paypalCaptureId = extraFields.paypalCaptureId;
  }

  payments.set(paymentId, payment);
  return payment;
}

export function recordAuditEvent(
  paymentId: string,
  action: AuditEvent['action'],
  actor: AuditEvent['actor'],
  details: Record<string, unknown>,
  note?: string,
): void {
  const payment = payments.get(paymentId);
  if (!payment) return;

  const now = new Date().toISOString();
  payment.auditTrail.push({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    action,
    actor,
    details,
    note,
  });
  payment.updatedAt = now;
}

/**
 * Resets the in-memory store. Intended strictly for automated test suites.
 */
export function resetPaymentStore(): void {
  payments.clear();
  counter = 1;
}
