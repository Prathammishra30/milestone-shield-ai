import { SupabaseClient } from '@supabase/supabase-js';
import { TrackedPayment, SandboxPaymentStatus, AuditEvent } from '../services/paymentStore';

interface DbPaymentRow {
  id: string;
  milestone_id: string;
  contract_id: string;
  created_by?: string | null;
  amount: number | string;
  currency: string;
  status: string;
  paypal_order_id?: string | null;
  paypal_authorization_id?: string | null;
  paypal_capture_id?: string | null;
  approve_url?: string | null;
  idempotency_key?: string | null;
  operator_notes?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
  milestones?: {
    title: string;
  };
  contracts?: {
    title: string;
  };
}

function mapDbPaymentStatusToApp(dbStatus: string): SandboxPaymentStatus {
  switch (dbStatus.toLowerCase()) {
    case 'created':
    case 'order_created':
      return 'ORDER_CREATED';
    case 'authorized':
      return 'AUTHORIZED';
    case 'captured':
      return 'CAPTURED';
    case 'voided':
      return 'VOIDED';
    case 'failed':
      return 'FAILED';
    default:
      return 'ORDER_CREATED';
  }
}

function mapAppStatusToDb(appStatus: SandboxPaymentStatus): string {
  switch (appStatus) {
    case 'ORDER_CREATED':
      return 'created';
    case 'AUTHORIZED':
      return 'authorized';
    case 'CAPTURED':
      return 'captured';
    case 'VOIDED':
      return 'voided';
    case 'FAILED':
      return 'failed';
  }
}

export function mapDbPaymentToApp(row: DbPaymentRow, auditTrail: AuditEvent[] = []): TrackedPayment {
  return {
    id: row.id,
    milestoneId: row.milestone_id,
    milestoneTitle: row.milestones?.title || 'Milestone',
    projectId: row.contract_id,
    projectName: row.contracts?.title || 'Contract Project',
    amount: Number(row.amount),
    currency: row.currency,
    status: mapDbPaymentStatusToApp(row.status),
    paypalOrderId: row.paypal_order_id || '',
    paypalAuthorizationId: row.paypal_authorization_id || undefined,
    paypalCaptureId: row.paypal_capture_id || undefined,
    approveUrl: row.approve_url || undefined,
    idempotencyKey: row.idempotency_key || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    auditTrail,
  };
}

/**
 * Retrieves payment by milestone ID with user client (RLS enforced).
 */
export async function dbGetPaymentByMilestoneId(
  client: SupabaseClient,
  milestoneId: string
): Promise<TrackedPayment | null> {
  const { data, error } = await client
    .from('payments')
    .select('*, milestones(title), contracts(title)')
    .eq('milestone_id', milestoneId)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error retrieving payment for milestone '${milestoneId}': ${error.message}`);
  }

  if (!data) return null;
  return mapDbPaymentToApp(data);
}

/**
 * Retrieves payment by PayPal Order ID.
 */
export async function dbGetPaymentByOrderId(
  client: SupabaseClient,
  orderId: string
): Promise<TrackedPayment | null> {
  const { data, error } = await client
    .from('payments')
    .select('*, milestones(title), contracts(title)')
    .eq('paypal_order_id', orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error retrieving payment for order '${orderId}': ${error.message}`);
  }

  if (!data) return null;
  return mapDbPaymentToApp(data);
}

/**
 * Retrieves payment by PayPal Authorization ID.
 */
export async function dbGetPaymentByAuthId(
  client: SupabaseClient,
  authId: string
): Promise<TrackedPayment | null> {
  const { data, error } = await client
    .from('payments')
    .select('*, milestones(title), contracts(title)')
    .eq('paypal_authorization_id', authId)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error retrieving payment for auth ID '${authId}': ${error.message}`);
  }

  if (!data) return null;
  return mapDbPaymentToApp(data);
}

/**
 * Retrieves payment by PayPal Capture ID.
 */
export async function dbGetPaymentByCaptureId(
  client: SupabaseClient,
  captureId: string
): Promise<TrackedPayment | null> {
  const { data, error } = await client
    .from('payments')
    .select('*, milestones(title), contracts(title)')
    .eq('paypal_capture_id', captureId)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error retrieving payment for capture ID '${captureId}': ${error.message}`);
  }

  if (!data) return null;
  return mapDbPaymentToApp(data);
}

/**
 * Lists payments for the caller.
 * PostgreSQL RLS ('payments_select_member') filters payments to contracts the user belongs to.
 */
export async function dbListPayments(client: SupabaseClient): Promise<TrackedPayment[]> {
  const { data, error } = await client
    .from('payments')
    .select('*, milestones(title), contracts(title)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Database error listing payments: ${error.message}`);
  }

  return (data || []).map((row) => mapDbPaymentToApp(row));
}

/**
 * Inserts a payment record into PostgreSQL using the privileged service-role client.
 *
 * CRITICAL FINANCIAL CONTROL (Requirement 5):
 * Only the backend server with trusted identity and authorized contract membership
 * initiates payment records. Browser clients have REVOKED insert privileges.
 */
export async function dbCreatePaymentRecord(
  serviceClient: SupabaseClient,
  input: {
    milestoneId: string;
    contractId: string;
    createdBy: string;
    amount: number;
    currency: string;
    paypalOrderId: string;
    approveUrl?: string;
    idempotencyKey?: string;
    note?: string;
  }
): Promise<TrackedPayment> {
  const { data, error } = await serviceClient
    .from('payments')
    .insert({
      milestone_id: input.milestoneId,
      contract_id: input.contractId,
      created_by: input.createdBy,
      amount: input.amount,
      currency: input.currency,
      status: 'created',
      paypal_order_id: input.paypalOrderId,
      approve_url: input.approveUrl || null,
      idempotency_key: input.idempotencyKey || null,
      note: input.note || null,
    })
    .select('*, milestones(title), contracts(title)')
    .single();

  if (error) {
    throw new Error(`Database error recording payment in PostgreSQL: ${error.message}`);
  }

  // Also log initial audit event via service client
  await serviceClient.from('audit_events').insert({
    entity_type: 'payment',
    entity_id: data.id,
    action: 'ORDER_CREATED',
    actor_id: input.createdBy,
    actor_role: 'client',
    payload: {
      paypalOrderId: input.paypalOrderId,
      amount: input.amount,
      currency: input.currency,
      milestoneId: input.milestoneId,
    },
  });

  return mapDbPaymentToApp(data);
}

/**
 * Concurrency-safe transition using RPC 'record_payment_transition' (FOR UPDATE lock)
 */
export async function dbRecordPaymentTransition(
  serviceClient: SupabaseClient,
  input: {
    paymentId: string;
    newStatus: SandboxPaymentStatus;
    actorId: string;
    actorRole: string;
    action: string;
    payload?: Record<string, unknown>;
    operatorNotes?: string;
    paypalAuthId?: string;
    paypalCaptureId?: string;
  }
): Promise<void> {
  // First update PayPal gateway identifiers if provided
  if (input.paypalAuthId || input.paypalCaptureId) {
    const updatePayload: Record<string, unknown> = {};
    if (input.paypalAuthId) updatePayload.paypal_authorization_id = input.paypalAuthId;
    if (input.paypalCaptureId) updatePayload.paypal_capture_id = input.paypalCaptureId;

    await serviceClient
      .from('payments')
      .update(updatePayload)
      .eq('id', input.paymentId);
  }

  // Call the atomic stored procedure with row-level lock
  const { error } = await serviceClient.rpc('record_payment_transition', {
    p_payment_id: input.paymentId,
    p_new_status: mapAppStatusToDb(input.newStatus),
    p_actor_id: input.actorId,
    p_actor_role: input.actorRole,
    p_action: input.action,
    p_payload: input.payload || {},
    p_operator_notes: input.operatorNotes || null,
  });

  if (error) {
    // If the RPC is not deployed in older migrations, fall back to direct service update
    const { error: updateErr } = await serviceClient
      .from('payments')
      .update({
        status: mapAppStatusToDb(input.newStatus),
        operator_notes: input.operatorNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.paymentId);

    if (updateErr) {
      throw new Error(`Database error updating payment status: ${updateErr.message}`);
    }

    // Insert audit event
    await serviceClient.from('audit_events').insert({
      entity_type: 'payment',
      entity_id: input.paymentId,
      action: input.action,
      actor_id: input.actorId,
      actor_role: input.actorRole,
      payload: input.payload || {},
    });
  }
}
