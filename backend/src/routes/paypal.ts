import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { getMilestoneById, updateMilestoneStatus } from '../models/milestones';
import {
  createPaymentRecord,
  getPaymentByAuthorizationId,
  getPaymentByMilestoneId,
  getPaymentByOrderId,
  listPayments,
  recordAuditEvent,
  updatePaymentStatus,
  claimIdempotencyKey,
  TrackedPayment,
} from '../services/paymentStore';
import { paypalClient } from '../services/paypalClient';
import { PaymentPolicyEngine } from '../services/paymentPolicy';
import { spendingLimitService } from '../services/spendingLimitService';
import { requireAuth } from '../middleware/auth';
import { requireMilestoneContractMember, requireRole } from '../middleware/contractGuard';
import { paymentMutatingLimiter } from '../middleware/rateLimiter';
import { isUserContractMember } from '../models/contracts';
import {
  isSupabaseConfigured,
  getServiceSupabaseClient,
  dbCreatePaymentRecord,
  dbRecordPaymentTransition,
  dbGetPaymentByMilestoneId,
  assertDatabaseReadinessForPayments,
} from '../db';
import { isSafePublicHttpsUrl } from '../utils/urlValidator';
import { env } from '../config/env';

const router = Router();

function getParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

// ── Validation Schemas ──────────────────────────────────────────────

const createOrderBodySchema = z
  .object({
    returnUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    idempotencyKey: z.string().optional(),
    amount: z.unknown().optional(),
  })
  .refine((data) => data.amount === undefined, {
    message:
      'Client-supplied amounts are strictly forbidden. The milestone payment amount is derived from trusted server-side milestone data.',
  })
  .refine((data) => {
    // F-8: Validate redirect URLs against frontend origin allowlist (CORS_ORIGIN)
    // and SSRF guard. A URL is accepted only if its origin matches the configured
    // frontend origin, or (when no CORS_ORIGIN is set) is a safe public HTTPS URL.
    const validateUrl = (url?: string): boolean => {
      if (!url) return true; // optional field
      try {
        const urlOrigin = new URL(url).origin;
        // Primary: origin must match configured frontend origin
        if (env.CORS_ORIGIN && urlOrigin === env.CORS_ORIGIN) return true;
        // Secondary: when no CORS_ORIGIN is configured, fall back to SSRF guard
        if (!env.CORS_ORIGIN) return isSafePublicHttpsUrl(url);
        return false;
      } catch {
        return false;
      }
    };
    return validateUrl(data.returnUrl) && validateUrl(data.cancelUrl);
  }, {
    message:
      'returnUrl and cancelUrl must point to a safe public HTTPS URL or the configured frontend origin (CORS_ORIGIN).',
  });

const captureBodySchema = z.object({
  confirmed: z.boolean({
    error: 'Explicit release confirmation boolean is required to capture an authorized payment.',
  }),
  operatorNote: z.string().max(500).optional(),
  idempotencyKey: z.string().optional(),
});

const voidBodySchema = z.object({
  reason: z.string().max(500).optional(),
  idempotencyKey: z.string().optional(),
});

// ── 1. Create PayPal Orders v2 with Intent AUTHORIZE ────────────────

router.post(
  '/milestones/:id/paypal/order',
  requireAuth,
  requireMilestoneContractMember('id'),
  requireRole(['client', 'admin']),
  paymentMutatingLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const milestoneId = getParamString(req.params.id);
      const parseResult = createOrderBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        next(parseResult.error);
        return;
      }

      const milestone = getMilestoneById(milestoneId);
      if (!milestone) {
        throw new AppError(`Milestone not found: '${milestoneId}'`, 404);
      }

      if (milestone.status === 'paid') {
        throw new AppError(
          `Milestone '${milestoneId}' is already settled/paid. Cannot create a new authorization order.`,
          400,
        );
      }

      // Check existing tracked payments
      const existingPayment = getPaymentByMilestoneId(milestoneId);
      if (existingPayment) {
        if (existingPayment.status === 'CAPTURED') {
          throw new AppError(
            `Milestone '${milestoneId}' has already been paid and captured in PayPal Sandbox.`,
            409,
          );
        }
        if (existingPayment.status === 'AUTHORIZED') {
          throw new AppError(
            `Milestone '${milestoneId}' is already authorized (Auth ID: ${existingPayment.paypalAuthorizationId}). Capture or void the existing authorization before creating a new order.`,
            409,
          );
        }
      }

      // Enforce platform milestone financial hard caps ($50,000 max single milestone authorization)
      spendingLimitService.validateMilestoneAmount(milestone.amount);

      // Derive amount and currency from server milestone (financial safety principle)
      const order = await paypalClient.createAuthorizeOrder({
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        amount: milestone.amount,
        currency: milestone.currency,
        returnUrl: parseResult.data.returnUrl,
        cancelUrl: parseResult.data.cancelUrl,
        idempotencyKey: parseResult.data.idempotencyKey,
      });

      // Persist to in-memory payment store
      const paymentRecord = createPaymentRecord({
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        projectId: milestone.projectId,
        projectName: milestone.projectName,
        amount: milestone.amount,
        currency: milestone.currency,
        paypalOrderId: order.orderId,
        approveUrl: order.approveUrl,
        idempotencyKey: parseResult.data.idempotencyKey,
        note: `PayPal Orders v2 order created in Sandbox with intent AUTHORIZE for $${milestone.amount} ${milestone.currency}`,
      });

      // Persist to PostgreSQL if Supabase is configured
      const serviceClient = getServiceSupabaseClient();
      if (serviceClient && isSupabaseConfigured()) {
        try {
          await dbCreatePaymentRecord(serviceClient, {
            milestoneId: milestone.id,
            contractId: milestone.projectId,
            createdBy: req.user!.id,
            amount: milestone.amount,
            currency: milestone.currency,
            paypalOrderId: order.orderId,
            approveUrl: order.approveUrl,
            idempotencyKey: parseResult.data.idempotencyKey,
            note: `PayPal Orders v2 order created in Sandbox with intent AUTHORIZE for $${milestone.amount} ${milestone.currency}`,
          });
        } catch (dbErr) {
          if (env.NODE_ENV === 'production') {
            throw new AppError(
              `Financial database write failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}. Order aborted to preserve ledger integrity.`,
              500
            );
          }
          console.warn('[Payments DB] Could not persist payment to PostgreSQL in non-production mode:', dbErr);
        }
      } else if (env.NODE_ENV === 'production') {
        throw new AppError(
          'Production environment requires active Supabase service client for financial ledger recording. In-memory fallback rejected.',
          500
        );
      }

      res.status(201).json({
        status: 'success',
        data: {
          orderId: order.orderId,
          status: order.status,
          approveUrl: order.approveUrl,
          milestoneId: milestone.id,
          amount: milestone.amount,
          currency: milestone.currency,
          paymentRecordId: paymentRecord.id,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── 2. Authorize PayPal Order After Buyer Approval ──────────────────

router.post(
  '/payments/paypal/orders/:id/authorize',
  requireAuth,
  requireRole(['client', 'admin']),
  paymentMutatingLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = getParamString(req.params.id);
      const idempotencyKey = (req.body?.idempotencyKey as string) || (req.headers['x-idempotency-key'] as string);

      const payment = getPaymentByOrderId(orderId);
      if (payment) {
        if (!isUserContractMember(payment.projectId, req.user!.id) && req.user!.role !== 'admin') {
          throw new AppError('Forbidden: You are not authorized to authorize payments for this contract.', 403);
        }
        PaymentPolicyEngine.validateAuthorizeEligibility(payment);
      }

      const result = await paypalClient.authorizeOrder(orderId, idempotencyKey);

      if (payment) {
        updatePaymentStatus(
          payment.id,
          'AUTHORIZED',
          'AUTHORIZED',
          'system',
          {
            paypalOrderId: orderId,
            paypalAuthorizationId: result.authorizationId,
            status: result.status,
            amount: result.amount,
            expirationTime: result.expirationTime,
          },
          'PayPal order authorized successfully after buyer approval.',
          {
            paypalAuthorizationId: result.authorizationId,
          },
        );

        const serviceClient = getServiceSupabaseClient();
        if (serviceClient && isSupabaseConfigured()) {
          try {
            await dbRecordPaymentTransition(serviceClient, {
              paymentId: payment.id,
              newStatus: 'AUTHORIZED',
              actorId: req.user!.id,
              actorRole: req.user!.role,
              action: 'AUTHORIZED',
              payload: { paypalOrderId: orderId, paypalAuthorizationId: result.authorizationId, amount: result.amount },
              paypalAuthId: result.authorizationId,
            });
          } catch (dbErr) {
            if (env.NODE_ENV === 'production') {
              throw new AppError(
                `Financial authorization database update failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}. Operation aborted to preserve ledger integrity.`,
                500
              );
            }
            console.warn('[Payments DB] Could not record authorization in PostgreSQL in non-production mode:', dbErr);
          }
        } else if (env.NODE_ENV === 'production') {
          throw new AppError(
            'Production environment requires active Supabase service client for financial ledger recording. In-memory fallback rejected.',
            500
          );
        }
      }

      res.status(200).json({
        status: 'success',
        data: {
          orderId: result.orderId,
          authorizationId: result.authorizationId,
          status: 'AUTHORIZED',
          amount: result.amount,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── 3. Explicit Operator Capture of Authorized Payment ──────────────

router.post(
  '/payments/paypal/authorizations/:id/capture',
  requireAuth,
  requireRole(['client', 'admin']),
  paymentMutatingLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authorizationId = getParamString(req.params.id);
      const parseResult = captureBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        next(parseResult.error);
        return;
      }

      const payment = getPaymentByAuthorizationId(authorizationId);
      if (!payment) {
        throw new AppError(
          `No local payment record found for authorization ID '${authorizationId}'.`,
          404,
        );
      }

      if (!isUserContractMember(payment.projectId, req.user!.id) && req.user!.role !== 'admin') {
        throw new AppError('Forbidden: You are not authorized to capture payments for this contract.', 403);
      }

      // Idempotency: if already captured, return existing result without calling PayPal again.
      if (payment.status === 'CAPTURED') {
        recordAuditEvent(
          payment.id,
          'DUPLICATE_CAPTURE_PREVENTED',
          'operator',
          {
            attemptedAuthId: authorizationId,
            currentStatus: payment.status,
            existingCaptureId: payment.paypalCaptureId,
            reason: 'Capture already completed; returning existing result.',
          },
          'Duplicate capture request for already-captured payment.',
        );
        throw new AppError(
          `Payment '${payment.id}' (Auth: ${payment.paypalAuthorizationId}) has already been captured. Duplicate capture attempts are prevented by policy.`,
          409,
        );
      }

      // Claim server-side idempotency key (rejects duplicate/replayed keys).
      const idempotencyKey = parseResult.data.idempotencyKey;
      if (idempotencyKey && !claimIdempotencyKey(idempotencyKey)) {
        throw new AppError(
          `Idempotency key '${idempotencyKey}' has already been used for this payment. Duplicate request rejected.`,
          409,
        );
      }

      // Enforce strict policy: AUTHORIZED status + explicit confirmation
      try {
        PaymentPolicyEngine.validateCaptureEligibility(payment, parseResult.data);
      } catch (policyErr) {
        recordAuditEvent(
          payment.id,
          'DUPLICATE_CAPTURE_PREVENTED',
          'operator',
          {
            attemptedAuthId: authorizationId,
            currentStatus: payment.status,
            error: policyErr instanceof Error ? policyErr.message : String(policyErr),
          },
          'Capture rejected by policy engine.',
        );
        throw policyErr;
      }

      const captureResult = await paypalClient.captureAuthorization(authorizationId, {
        note: parseResult.data.operatorNote,
        idempotencyKey: parseResult.data.idempotencyKey,
      });

      // Conditional in-memory update: only transition if still AUTHORIZED.
      // Prevents double-capture races where two concurrent requests both passed validation.
      updatePaymentStatus(
        payment.id,
        'CAPTURED',
        'CAPTURED',
        'operator',
        {
          authorizationId,
          captureId: captureResult.captureId,
          amount: captureResult.amount,
          operatorNote: parseResult.data.operatorNote,
        },
        'Explicit operator confirmation supplied; PayPal Sandbox capture executed.',
        {
          paypalCaptureId: captureResult.captureId,
        },
        'AUTHORIZED', // expectedStatus: conditional transition
      );

      const serviceClient = getServiceSupabaseClient();
      if (serviceClient && isSupabaseConfigured()) {
        try {
          await dbRecordPaymentTransition(serviceClient, {
            paymentId: payment.id,
            newStatus: 'CAPTURED',
            actorId: req.user!.id,
            actorRole: req.user!.role,
            action: 'CAPTURED',
            payload: { authorizationId, captureId: captureResult.captureId, amount: captureResult.amount },
            operatorNotes: parseResult.data.operatorNote,
            paypalCaptureId: captureResult.captureId,
          });
        } catch (dbErr) {
          if (env.NODE_ENV === 'production') {
            throw new AppError(
              `Financial capture database update failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}. Operation aborted to preserve ledger integrity.`,
              500
            );
          }
          console.warn('[Payments DB] Could not record capture in PostgreSQL in non-production mode:', dbErr);
        }
      } else if (env.NODE_ENV === 'production') {
        throw new AppError(
          'Production environment requires active Supabase service client for financial ledger recording. In-memory fallback rejected.',
          500
        );
      }

      // Mark milestone as paid in trusted store
      updateMilestoneStatus(payment.milestoneId, 'paid');

      res.status(200).json({
        status: 'success',
        data: {
          authorizationId,
          captureId: captureResult.captureId,
          status: 'CAPTURED',
          amount: captureResult.amount,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── 4. Guarded Void of Uncaptured Authorization ─────────────────────

router.post(
  '/payments/paypal/authorizations/:id/void',
  requireAuth,
  requireRole(['client', 'admin']),
  paymentMutatingLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authorizationId = getParamString(req.params.id);
      const parseResult = voidBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        next(parseResult.error);
        return;
      }

      const payment = getPaymentByAuthorizationId(authorizationId);
      if (!payment) {
        throw new AppError(
          `No local payment record found for authorization ID '${authorizationId}'.`,
          404,
        );
      }

      if (!isUserContractMember(payment.projectId, req.user!.id) && req.user!.role !== 'admin') {
        throw new AppError('Forbidden: You are not authorized to void payments for this contract.', 403);
      }

      // Idempotency: if already voided, return existing result without calling PayPal again.
      if (payment.status === 'VOIDED') {
        recordAuditEvent(
          payment.id,
          'DUPLICATE_VOID_PREVENTED',
          'operator',
          {
            attemptedAuthId: authorizationId,
            currentStatus: payment.status,
            reason: 'Authorization already voided; returning existing result.',
          },
          'Duplicate void request for already-voided authorization.',
        );
        throw new AppError(
          `Authorization '${payment.paypalAuthorizationId}' has already been voided.`,
          409,
        );
      }

      // Claim server-side idempotency key (rejects duplicate/replayed keys).
      const voidIdempotencyKey = parseResult.data.idempotencyKey;
      if (voidIdempotencyKey && !claimIdempotencyKey(voidIdempotencyKey)) {
        throw new AppError(
          `Idempotency key '${voidIdempotencyKey}' has already been used for this payment. Duplicate request rejected.`,
          409,
        );
      }

      PaymentPolicyEngine.validateVoidEligibility(payment);

      const result = await paypalClient.voidAuthorization(
        authorizationId,
        parseResult.data.idempotencyKey,
      );

      // Conditional in-memory update: only transition if still AUTHORIZED.
      updatePaymentStatus(
        payment.id,
        'VOIDED',
        'VOIDED',
        'operator',
        {
          authorizationId,
          reason: parseResult.data.reason || 'Operator voided authorization.',
        },
        'Authorization voided in PayPal Sandbox; temporary hold released.',
        undefined,
        'AUTHORIZED', // expectedStatus: conditional transition
      );

      const serviceClient = getServiceSupabaseClient();
      if (serviceClient && isSupabaseConfigured()) {
        try {
          await dbRecordPaymentTransition(serviceClient, {
            paymentId: payment.id,
            newStatus: 'VOIDED',
            actorId: req.user!.id,
            actorRole: req.user!.role,
            action: 'VOIDED',
            payload: { authorizationId, reason: parseResult.data.reason || 'Operator voided authorization.' },
            operatorNotes: parseResult.data.reason,
          });
        } catch (dbErr) {
          if (env.NODE_ENV === 'production') {
            throw new AppError(
              `Financial void database update failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}. Operation aborted to preserve ledger integrity.`,
              500
            );
          }
          console.warn('[Payments DB] Could not record void in PostgreSQL in non-production mode:', dbErr);
        }
      } else if (env.NODE_ENV === 'production') {
        throw new AppError(
          'Production environment requires active Supabase service client for financial ledger recording. In-memory fallback rejected.',
          500
        );
      }

      res.status(200).json({
        status: 'success',
        data: {
          authorizationId: result.authorizationId,
          status: 'VOIDED',
          message: 'Authorization successfully voided in PayPal Sandbox.',
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── 5. Read Endpoints for Sandbox Payment Status ────────────────────

router.get(
  '/payments/paypal',
  requireAuth,
  (req: Request, res: Response): void => {
    const allPayments = listPayments();
    const payments =
      req.user!.role === 'admin'
        ? allPayments
        : allPayments.filter((p) => isUserContractMember(p.projectId, req.user!.id));

    const summary = {
      totalTracked: payments.length,
      authorizedCount: payments.filter((p) => p.status === 'AUTHORIZED').length,
      capturedCount: payments.filter((p) => p.status === 'CAPTURED').length,
      voidedCount: payments.filter((p) => p.status === 'VOIDED').length,
      createdCount: payments.filter((p) => p.status === 'ORDER_CREATED').length,
    };

    res.status(200).json({
      status: 'success',
      data: {
        payments,
        summary,
        notice: 'Tracked Sandbox transactions (in-memory test store). Not an escrow service.',
      },
    });
  },
);

router.get(
  '/payments/paypal/milestone/:milestoneId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const milestoneId = getParamString(req.params.milestoneId);
    let payment = getPaymentByMilestoneId(milestoneId);

    if (req.supabase && isSupabaseConfigured()) {
      try {
        const dbPayment = await dbGetPaymentByMilestoneId(req.supabase, milestoneId);
        if (dbPayment) payment = dbPayment;
      } catch {
        // Fall back gracefully
      }
    }
    if (!payment) {
      res.status(404).json({
        status: 'error',
        message: `No PayPal Sandbox payment record found for milestone '${milestoneId}'.`,
      });
      return;
    }

    if (!isUserContractMember(payment.projectId, req.user!.id) && req.user!.role !== 'admin') {
      res.status(403).json({
        status: 'error',
        message: 'Forbidden: You do not have access to this payment record.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: payment,
    });
  },
);

router.get(
  '/payments/paypal/orders/:id',
  requireAuth,
  (req: Request, res: Response): void => {
    const orderId = getParamString(req.params.id);
    const payment = getPaymentByOrderId(orderId);
    if (!payment) {
      res.status(404).json({
        status: 'error',
        message: `No PayPal Sandbox payment record found for order ID '${orderId}'.`,
      });
      return;
    }

    if (!isUserContractMember(payment.projectId, req.user!.id) && req.user!.role !== 'admin') {
      res.status(403).json({
        status: 'error',
        message: 'Forbidden: You do not have access to this payment record.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: payment,
    });
  },
);

router.get(
  '/payments/paypal/authorizations/:id',
  requireAuth,
  (req: Request, res: Response): void => {
    const authorizationId = getParamString(req.params.id);
    const payment = getPaymentByAuthorizationId(authorizationId);
    if (!payment) {
      res.status(404).json({
        status: 'error',
        message: `No PayPal Sandbox payment record found for authorization ID '${authorizationId}'.`,
      });
      return;
    }

    if (!isUserContractMember(payment.projectId, req.user!.id) && req.user!.role !== 'admin') {
      res.status(403).json({
        status: 'error',
        message: 'Forbidden: You do not have access to this payment record.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: payment,
    });
  },
);

export default router;
