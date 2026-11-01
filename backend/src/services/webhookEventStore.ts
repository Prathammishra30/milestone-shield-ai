/**
 * Webhook Event Store — Idempotent Event Tracking
 *
 * Tracks PayPal webhook event IDs to prevent duplicate processing.
 * Uses an in-memory store (dev/test) with optional PostgreSQL persistence.
 *
 * SAFETY RULES:
 * 1. A webhook event is recorded BEFORE processing to guarantee at-most-once semantics.
 * 2. If processing fails, the event is marked 'failed' (not removed) so retries are logged.
 * 3. Never remove processed events — the dedup set must survive for the event's lifetime.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type WebhookEventStatus = 'received' | 'processing' | 'processed' | 'ignored' | 'failed' | 'unmatched';

export interface WebhookEventRecord {
  id: string;
  paypalEventId: string;
  eventType: string;
  resourceType?: string;
  status: WebhookEventStatus;
  paymentId?: string;
  paypalOrderId?: string;
  paypalAuthorizationId?: string;
  paypalCaptureId?: string;
  processingNotes?: string;
  errorMessage?: string;
  receivedAt: string;
  processedAt?: string;
}

// ── In-Memory Dedup Store (dev/test) ────────────────────────────────

const processedEvents = new Map<string, WebhookEventRecord>();

/**
 * Checks if a webhook event ID has already been received/processed.
 *
 * SAFETY: Only 'processed' and 'ignored' are final/terminal states.
 * 'received', 'failed', and 'unmatched' are NOT final — they must be
 * reprocessable so PayPal retries are not permanently discarded.
 */
export function isEventAlreadyProcessed(paypalEventId: string): boolean {
  const existing = processedEvents.get(paypalEventId);
  if (!existing) return false;
  return existing.status === 'processed' || existing.status === 'ignored';
}

/**
 * Records a webhook event as received (before processing).
 */
export function recordWebhookEvent(event: WebhookEventRecord): void {
  processedEvents.set(event.paypalEventId, event);
}

/**
 * Checks whether a webhook event ID is already tracked in the in-memory store.
 */
export function hasWebhookEvent(paypalEventId: string): boolean {
  return processedEvents.has(paypalEventId);
}
/**
 * Atomically claims a webhook event for (re)processing.
 *
 * Returns true if this caller may process the event. Returns false if:
 * - the event is already 'processed' or 'ignored' (final states), or
 * - the event is currently 'processing' by another concurrent delivery.
 *
 * For new events (not yet in the store), returns true (caller should record it).
 * For 'received' / 'failed' / 'unmatched' events, transitions to 'processing'
 * and returns true, ensuring exactly-one processing under concurrent retries.
 */
export function claimWebhookEventForReprocessing(paypalEventId: string): boolean {
  const existing = processedEvents.get(paypalEventId);
  if (!existing) return true; // New event, safe to process
  if (existing.status === 'processed' || existing.status === 'ignored') return false;
  if (existing.status === 'processing') return false;
  // received / failed / unmatched: claim for reprocessing
  existing.status = 'processing';
  return true;
}

/**
 * Updates the status of a recorded webhook event after processing.
 */
export function updateWebhookEventStatus(
  paypalEventId: string,
  status: WebhookEventStatus,
  notes?: string,
  errorMsg?: string,
): void {
  const existing = processedEvents.get(paypalEventId);
  if (!existing) return;
  existing.status = status;
  existing.processedAt = new Date().toISOString();
  if (notes) existing.processingNotes = notes;
  if (errorMsg) existing.errorMessage = errorMsg;
}

/**
 * Resets the in-memory store. Intended strictly for automated test suites.
 */
export function resetWebhookEventStore(): void {
  processedEvents.clear();
}

// ── Database-backed Dedup (PostgreSQL via service-role) ────────────────

/**
 * Attempts to insert a webhook event into PostgreSQL.
 * Returns true if insertion succeeded (event is new), false if duplicate.
 */
export async function dbTryRecordWebhookEvent(
  serviceClient: SupabaseClient,
  event: {
    paypalEventId: string;
    eventType: string;
    resourceType?: string;
    paypalOrderId?: string;
    paypalAuthorizationId?: string;
    paypalCaptureId?: string;
  },
): Promise<{ isNew: boolean; id?: string }> {
  // Attempt upsert with ON CONFLICT DO NOTHING semantics
  const { data, error } = await serviceClient
    .from('webhook_events')
    .insert({
      paypal_event_id: event.paypalEventId,
      event_type: event.eventType,
      resource_type: event.resourceType || null,
      status: 'received',
      paypal_order_id: event.paypalOrderId || null,
      paypal_authorization_id: event.paypalAuthorizationId || null,
      paypal_capture_id: event.paypalCaptureId || null,
      received_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    // Unique constraint violation = duplicate event
    if (error.code === '23505') {
      return { isNew: false };
    }
    throw new Error(`Database error recording webhook event: ${error.message}`);
  }

  return { isNew: true, id: data?.id };
}

/**
 * Atomically claims a webhook event in PostgreSQL for (re)processing.
 *
 * Uses UPDATE ... WHERE status IN ('received','failed','unmatched') so that
 * only one concurrent delivery can claim and process the event. Returns
 * { claimed: true } if this caller won the race, { claimed: false } if the
 * event is in a final state ('processed'/'ignored') or is already 'processing'.
 */
export async function dbClaimWebhookEventForReprocessing(
  serviceClient: SupabaseClient,
  paypalEventId: string
): Promise<{ claimed: boolean; id?: string }> {
  const { data, error } = await serviceClient
    .from('webhook_events')
    .update({ status: 'processing', processed_at: new Date().toISOString() })
    .eq('paypal_event_id', paypalEventId)
    .in('status', ['received', 'failed', 'unmatched'])
    .select('id')
    .single();

  if (error) {
    // No rows matched (not in reprocessable state, or doesn't exist yet)
    return { claimed: false };
  }
  return { claimed: true, id: data?.id };
}

/**
 * Updates a webhook event's processing status in PostgreSQL.
 */
export async function dbUpdateWebhookEventStatus(
  serviceClient: SupabaseClient,
  webhookEventId: string,
  status: WebhookEventStatus,
  paymentId?: string,
  notes?: string,
  errorMsg?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    processed_at: new Date().toISOString(),
  };
  if (paymentId) update.payment_id = paymentId;
  if (notes) update.processing_notes = notes;
  if (errorMsg) update.error_message = errorMsg;

  await serviceClient
    .from('webhook_events')
    .update(update)
    .eq('id', webhookEventId);
}
