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

export type WebhookEventStatus = 'received' | 'processed' | 'ignored' | 'failed';

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
 */
export function isEventAlreadyProcessed(paypalEventId: string): boolean {
  const existing = processedEvents.get(paypalEventId);
  if (!existing) return false;
  // Consider 'received' and 'processed' as already handled (at-most-once)
  return existing.status === 'processed' || existing.status === 'received';
}

/**
 * Records a webhook event as received (before processing).
 */
export function recordWebhookEvent(event: WebhookEventRecord): void {
  processedEvents.set(event.paypalEventId, event);
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
