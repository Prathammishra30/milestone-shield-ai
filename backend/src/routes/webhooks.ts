import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { webhookLimiter } from '../middleware/rateLimiter';
import { paypalClient } from '../services/paypalClient';
import {
  getPaymentByOrderId,
  getPaymentByAuthorizationId,
  getPaymentByCaptureId,
  getPaymentByMilestoneId,
  updatePaymentStatus,
  recordAuditEvent,
  TrackedPayment,
} from '../services/paymentStore';
import {
  isEventAlreadyProcessed,
  recordWebhookEvent,
  updateWebhookEventStatus,
  dbTryRecordWebhookEvent,
  dbUpdateWebhookEventStatus,
} from '../services/webhookEventStore';
import {
  isSupabaseConfigured,
  getServiceSupabaseClient,
  dbGetPaymentByOrderId,
  dbGetPaymentByAuthId,
  dbGetPaymentByCaptureId,
  dbGetPaymentByMilestoneId,
  dbRecordPaymentTransition,
} from '../db';
import { updateMilestoneStatus } from '../models/milestones';

const router = Router();

/**
 * Validates that a cert_url points to a legitimate PayPal certificate host via HTTPS.
 * Prevents SSRF attacks.
 */
function isValidPayPalCertUrl(certUrl: string): boolean {
  try {
    const parsed = new URL(certUrl);
    if (parsed.protocol !== 'https:') return false;
    // Allow paypal.com and subdomains (*.paypal.com)
    return (
      parsed.hostname === 'paypal.com' ||
      parsed.hostname.endsWith('.paypal.com')
    );
  } catch {
    return false;
  }
}

/**
 * Extracts a header value case-insensitively.
 */
function getHeader(req: Request, headerName: string): string | undefined {
  const value = req.headers[headerName.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Resolves a local payment record matching a webhook event resource.
 * Searches both in-memory store and persistent PostgreSQL (if configured).
 */
async function resolvePaymentRecord(
  resource: Record<string, unknown>
): Promise<TrackedPayment | null> {
  const resourceId = typeof resource.id === 'string' ? resource.id : undefined;
  const customId = typeof resource.custom_id === 'string' ? resource.custom_id : undefined;

  // Supplementary data / related IDs
  const suppData = resource.supplementary_data as Record<string, unknown> | undefined;
  const relatedIds = suppData?.related_ids as Record<string, unknown> | undefined;
  const orderId =
    (typeof relatedIds?.order_id === 'string' ? relatedIds.order_id : undefined) ||
    (typeof resource.parent_payment === 'string' ? undefined : resourceId);
  const authId =
    (typeof relatedIds?.authorization_id === 'string' ? relatedIds.authorization_id : undefined) ||
    (typeof resource.parent_payment === 'string' ? resource.parent_payment : undefined);

  // 1. Try In-Memory Store
  let payment: TrackedPayment | undefined;
  if (authId) payment = getPaymentByAuthorizationId(authId);
  if (!payment && resourceId) payment = getPaymentByAuthorizationId(resourceId);
  if (!payment && resourceId) payment = getPaymentByCaptureId(resourceId);
  if (!payment && orderId) payment = getPaymentByOrderId(orderId);
  if (!payment && resourceId) payment = getPaymentByOrderId(resourceId);
  if (!payment && customId) payment = getPaymentByMilestoneId(customId);

  if (payment) return payment;

  // 2. Try PostgreSQL via service role client if configured
  const serviceClient = getServiceSupabaseClient();
  if (serviceClient && isSupabaseConfigured()) {
    try {
      if (authId) {
        const dbP = await dbGetPaymentByAuthId(serviceClient, authId);
        if (dbP) return dbP;
      }
      if (resourceId) {
        const dbP = await dbGetPaymentByAuthId(serviceClient, resourceId);
        if (dbP) return dbP;
      }
      if (resourceId) {
        const dbP = await dbGetPaymentByCaptureId(serviceClient, resourceId);
        if (dbP) return dbP;
      }
      if (orderId) {
        const dbP = await dbGetPaymentByOrderId(serviceClient, orderId);
        if (dbP) return dbP;
      }
      if (resourceId) {
        const dbP = await dbGetPaymentByOrderId(serviceClient, resourceId);
        if (dbP) return dbP;
      }
      if (customId) {
        const dbP = await dbGetPaymentByMilestoneId(serviceClient, customId);
        if (dbP) return dbP;
      }
    } catch (err) {
      console.warn('[PayPal Webhook] Error querying database for payment record:', err);
    }
  }

  return null;
}

/**
 * Reconciles PayPal payment state with safe forward-only transitions.
 * Ensures final states (CAPTURED, VOIDED) are NEVER downgraded.
 */
async function reconcilePaymentTransition(params: {
  payment: TrackedPayment;
  newStatus: 'AUTHORIZED' | 'CAPTURED' | 'VOIDED' | 'FAILED';
  action:
    | 'AUTHORIZED'
    | 'CAPTURED'
    | 'VOIDED'
    | 'PAYMENT_FAILED'
    | 'BUYER_APPROVED'
    | 'INVALID_TRANSITION_REJECTED';
  details: Record<string, unknown>;
  note: string;
  paypalAuthId?: string;
  paypalCaptureId?: string;
}): Promise<void> {
  const { payment, newStatus, action, details, note, paypalAuthId, paypalCaptureId } = params;

  // ── State Machine Hierarchy & Forward-Only Transition Rules ──
  // Hierarchy: ORDER_CREATED (0) -> AUTHORIZED (1) -> CAPTURED (2) / VOIDED (2) / FAILED (2)
  if (payment.status === 'CAPTURED') {
    if (newStatus !== 'CAPTURED') {
      recordAuditEvent(
        payment.id,
        'INVALID_TRANSITION_REJECTED',
        'system',
        {
          attemptedStatus: newStatus,
          currentStatus: 'CAPTURED',
          reason: 'Cannot downgrade or modify already CAPTURED payment.',
        },
        'Stale or conflicting webhook event rejected; payment remains CAPTURED.'
      );
      return;
    }
    // Idempotent: already CAPTURED
    return;
  }

  if (payment.status === 'VOIDED') {
    if (newStatus !== 'VOIDED') {
      recordAuditEvent(
        payment.id,
        'INVALID_TRANSITION_REJECTED',
        'system',
        {
          attemptedStatus: newStatus,
          currentStatus: 'VOIDED',
          reason: 'Cannot modify already VOIDED authorization.',
        },
        'Stale or conflicting webhook event rejected; authorization remains VOIDED.'
      );
      return;
    }
    // Idempotent: already VOIDED
    return;
  }

  // 1. Update in-memory store
  updatePaymentStatus(
    payment.id,
    newStatus,
    action as any,
    'system',
    details,
    note,
    {
      paypalAuthorizationId: paypalAuthId,
      paypalCaptureId: paypalCaptureId,
    }
  );

  // If captured, mark milestone as paid in application memory
  if (newStatus === 'CAPTURED') {
    updateMilestoneStatus(payment.milestoneId, 'paid');
  }

  // 2. Update persistent database if configured
  const serviceClient = getServiceSupabaseClient();
  if (serviceClient && isSupabaseConfigured()) {
    try {
      await dbRecordPaymentTransition(serviceClient, {
        paymentId: payment.id,
        newStatus,
        actorId: payment.projectId, // Scoped to contract system
        actorRole: 'system',
        action,
        payload: details,
        operatorNotes: note,
        paypalAuthId,
        paypalCaptureId,
      });
    } catch (dbErr) {
      if (env.NODE_ENV === 'production') {
        throw new AppError(
          `Failed to record webhook state transition in PostgreSQL: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
          500
        );
      }
      console.warn('[PayPal Webhook] DB transition warning (non-prod):', dbErr);
    }
  }
}

// ── Webhook Handler ─────────────────────────────────────────────────

router.post(
  '/webhooks/paypal',
  webhookLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let paypalEventId = 'unknown';
    try {
      // 1. Check Webhook ID Configuration
      const configuredWebhookId = env.PAYPAL_WEBHOOK_ID?.trim();
      if (!configuredWebhookId) {
        throw new AppError(
          'PayPal webhook verification failed: PAYPAL_WEBHOOK_ID is not configured in backend/.env.',
          500
        );
      }

      // 2. Verify Required PayPal Transmission Headers
      const authAlgo = getHeader(req, 'paypal-auth-algo');
      const certUrl = getHeader(req, 'paypal-cert-url');
      const transmissionId = getHeader(req, 'paypal-transmission-id');
      const transmissionSig = getHeader(req, 'paypal-transmission-sig');
      const transmissionTime = getHeader(req, 'paypal-transmission-time');

      if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
        res.status(400).json({
          status: 'error',
          code: 'MISSING_TRANSMISSION_HEADERS',
          message:
            'Missing required PayPal webhook transmission headers (paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time).',
        });
        return;
      }

      // 3. SSRF Protection: Validate cert_url belongs to *.paypal.com
      if (!isValidPayPalCertUrl(certUrl)) {
        res.status(400).json({
          status: 'error',
          code: 'INVALID_CERT_URL',
          message: 'Invalid PayPal certificate URL: Certificate host must target a trusted *.paypal.com domain via HTTPS.',
        });
        return;
      }

      // 4. Validate Event Body Payload
      const event = req.body;
      if (!event || typeof event !== 'object' || Array.isArray(event)) {
        res.status(400).json({
          status: 'error',
          code: 'MALFORMED_EVENT_BODY',
          message: 'Malformed webhook event: Body must be a valid JSON object.',
        });
        return;
      }

      if (!event.id || typeof event.id !== 'string' || !event.event_type || typeof event.event_type !== 'string') {
        res.status(400).json({
          status: 'error',
          code: 'INVALID_EVENT_STRUCTURE',
          message: 'Malformed webhook event: Event missing required "id" or "event_type" field.',
        });
        return;
      }

      paypalEventId = event.id;
      const eventType = event.event_type;
      const resource = (event.resource || {}) as Record<string, unknown>;

      // 5. Cryptographic Signature Verification via PayPal
      const verifyResult = await paypalClient.verifyWebhookSignature({
        authAlgo,
        certUrl,
        transmissionId,
        transmissionSig,
        transmissionTime,
        webhookId: configuredWebhookId,
        webhookEvent: event,
      });

      if (verifyResult.verificationStatus !== 'SUCCESS') {
        res.status(400).json({
          status: 'error',
          code: 'SIGNATURE_VERIFICATION_FAILED',
          message: 'PayPal webhook signature verification failed. Signature does not match transmission payload.',
        });
        return;
      }

      // 6. Idempotency Check & Event Deduplication
      if (isEventAlreadyProcessed(paypalEventId)) {
        res.status(200).json({
          status: 'success',
          code: 'DUPLICATE_EVENT_IGNORED',
          message: `Webhook event '${paypalEventId}' has already been processed. Duplicate delivery acknowledged.`,
        });
        return;
      }

      const serviceClient = getServiceSupabaseClient();
      let dbWebhookEventId: string | undefined;

      if (serviceClient && isSupabaseConfigured()) {
        try {
          const recordRes = await dbTryRecordWebhookEvent(serviceClient, {
            paypalEventId,
            eventType,
            resourceType: typeof event.resource_type === 'string' ? event.resource_type : undefined,
            paypalOrderId: typeof resource.id === 'string' ? resource.id : undefined,
          });

          if (!recordRes.isNew) {
            res.status(200).json({
              status: 'success',
              code: 'DUPLICATE_EVENT_IGNORED',
              message: `Webhook event '${paypalEventId}' already recorded in database. Duplicate delivery acknowledged.`,
            });
            return;
          }
          dbWebhookEventId = recordRes.id;
        } catch (dbErr) {
          if (env.NODE_ENV === 'production') {
            throw new AppError(
              `Failed to record webhook event in PostgreSQL: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
              500
            );
          }
        }
      }

      // Record in in-memory dedup store as received
      recordWebhookEvent({
        id: `wh-${Date.now()}`,
        paypalEventId,
        eventType,
        resourceType: typeof event.resource_type === 'string' ? event.resource_type : undefined,
        status: 'received',
        receivedAt: new Date().toISOString(),
      });

      // 7. Event Reconciliation by Event Type
      const payment = await resolvePaymentRecord(resource);

      switch (eventType) {
        // Buyer approved the order in PayPal Checkout
        case 'CHECKOUT.ORDER.APPROVED': {
          if (payment) {
            recordAuditEvent(
              payment.id,
              'BUYER_APPROVED',
              'client',
              { paypalOrderId: resource.id, status: resource.status },
              'Buyer approved payment in PayPal Sandbox checkout.'
            );
          }
          break;
        }

        // Authorization hold created
        case 'PAYMENT.AUTHORIZATION.CREATED': {
          if (payment) {
            const authId = typeof resource.id === 'string' ? resource.id : undefined;
            await reconcilePaymentTransition({
              payment,
              newStatus: 'AUTHORIZED',
              action: 'AUTHORIZED',
              details: {
                paypalAuthorizationId: authId,
                status: resource.status,
                amount: resource.amount,
              },
              note: 'Payment authorization hold confirmed via PayPal webhook.',
              paypalAuthId: authId,
            });
          }
          break;
        }

        // Authorization voided
        case 'PAYMENT.AUTHORIZATION.VOIDED': {
          if (payment) {
            const authId = typeof resource.id === 'string' ? resource.id : undefined;
            await reconcilePaymentTransition({
              payment,
              newStatus: 'VOIDED',
              action: 'VOIDED',
              details: {
                paypalAuthorizationId: authId,
                status: 'VOIDED',
              },
              note: 'Payment authorization voided via PayPal webhook; hold released.',
              paypalAuthId: authId,
            });
          }
          break;
        }

        // Capture completed
        case 'PAYMENT.CAPTURE.COMPLETED': {
          if (payment) {
            const captureId = typeof resource.id === 'string' ? resource.id : undefined;
            await reconcilePaymentTransition({
              payment,
              newStatus: 'CAPTURED',
              action: 'CAPTURED',
              details: {
                paypalCaptureId: captureId,
                status: 'COMPLETED',
                amount: resource.amount,
              },
              note: 'Payment capture completed successfully via PayPal webhook.',
              paypalCaptureId: captureId,
            });
          }
          break;
        }

        // Capture denied or declined
        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.DECLINED': {
          if (payment) {
            await reconcilePaymentTransition({
              payment,
              newStatus: 'FAILED',
              action: 'PAYMENT_FAILED',
              details: {
                status: resource.status,
                reason: resource.status_details,
              },
              note: 'Payment capture denied/declined by PayPal.',
            });
          }
          break;
        }

        // Dispute created
        case 'CUSTOMER.DISPUTE.CREATED': {
          if (payment) {
            recordAuditEvent(
              payment.id,
              'INVALID_TRANSITION_REJECTED',
              'system',
              {
                disputeId: resource.dispute_id,
                reason: resource.reason,
                status: resource.status,
              },
              'Customer dispute created in PayPal. Payment status retained; audit recorded.'
            );
          }
          break;
        }

        // Dispute resolved
        case 'CUSTOMER.DISPUTE.RESOLVED': {
          if (payment) {
            recordAuditEvent(
              payment.id,
              'INVALID_TRANSITION_REJECTED',
              'system',
              {
                disputeId: resource.dispute_id,
                outcome: resource.dispute_outcome,
              },
              'Customer dispute resolved in PayPal.'
            );
          }
          break;
        }

        // Unsupported / unhandled event types
        default: {
          updateWebhookEventStatus(
            paypalEventId,
            'ignored',
            `Unsupported event type '${eventType}'. Acknowledged without state change.`
          );
          if (serviceClient && dbWebhookEventId) {
            await dbUpdateWebhookEventStatus(
              serviceClient,
              dbWebhookEventId,
              'ignored',
              payment?.id,
              `Unsupported event type '${eventType}'.`
            );
          }

          res.status(200).json({
            status: 'ignored',
            message: `Webhook event '${eventType}' acknowledged and ignored.`,
          });
          return;
        }
      }

      // 8. Mark event processed in stores
      updateWebhookEventStatus(
        paypalEventId,
        'processed',
        `Successfully processed ${eventType} event.`
      );
      if (serviceClient && dbWebhookEventId) {
        await dbUpdateWebhookEventStatus(
          serviceClient,
          dbWebhookEventId,
          'processed',
          payment?.id,
          `Successfully processed ${eventType} event.`
        );
      }

      res.status(200).json({
        status: 'success',
        message: `Webhook event '${eventType}' (${paypalEventId}) successfully processed.`,
        data: {
          eventId: paypalEventId,
          eventType,
          matchedPaymentId: payment?.id || null,
        },
      });
    } catch (err) {
      if (paypalEventId !== 'unknown') {
        updateWebhookEventStatus(
          paypalEventId,
          'failed',
          undefined,
          err instanceof Error ? err.message : String(err)
        );
      }
      next(err);
    }
  }
);

export default router;
