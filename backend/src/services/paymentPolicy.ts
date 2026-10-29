/**
 * Payment Policy Engine & State Transition Guard
 *
 * SAFETY PRINCIPLES:
 * 1. AI Isolation: AI agents and models are strictly prohibited from initiating or approving payments.
 *    Only explicit human operator actions can authorize, capture, or void milestone payments.
 * 2. Pre-Capture Verification: Payments can only be captured when in AUTHORIZED state AND an explicit
 *    operator confirmation boolean has been supplied.
 * 3. Idempotent Transition Guards: Duplicate captures, re-authorizations, or voiding of captured
 *    funds are immediately rejected with HTTP 409 Conflict.
 * 4. Escrow Clarification: MilestoneShield AI coordinates PayPal authorization holds.
 *    Funds are held on the client's payment instrument via PayPal, not in an escrow account.
 */

import { AppError } from '../middleware/errorHandler';
import { TrackedPayment } from './paymentStore';

export class PaymentPolicyEngine {
  /**
   * Validates whether an order is eligible for authorization.
   */
  public static validateAuthorizeEligibility(payment: TrackedPayment): void {
    if (payment.status === 'AUTHORIZED') {
      throw new AppError(
        `PayPal order '${payment.paypalOrderId}' is already authorized. Duplicate authorization attempts are disallowed.`,
        409,
      );
    }

    if (payment.status === 'CAPTURED') {
      throw new AppError(
        `PayPal order '${payment.paypalOrderId}' has already been settled and captured.`,
        409,
      );
    }

    if (payment.status === 'VOIDED') {
      throw new AppError(
        `PayPal order '${payment.paypalOrderId}' is voided and cannot be authorized.`,
        409,
      );
    }

    if (payment.status !== 'ORDER_CREATED') {
      throw new AppError(
        `Cannot authorize order in status '${payment.status}'. Expected 'ORDER_CREATED'.`,
        400,
      );
    }
  }

  /**
   * Validates whether an authorized payment is eligible for capture.
   * Requires explicit operator confirmation.
   */
  public static validateCaptureEligibility(
    payment: TrackedPayment,
    confirmation: { confirmed: boolean; operatorNote?: string },
  ): void {
    if (!confirmation.confirmed) {
      throw new AppError(
        'Explicit release confirmation (confirmed: true) is required to capture an authorized payment.',
        400,
      );
    }

    if (payment.status === 'CAPTURED') {
      throw new AppError(
        `Payment '${payment.id}' (Auth: ${payment.paypalAuthorizationId}) has already been captured. Duplicate capture attempts are prevented by policy.`,
        409,
      );
    }

    if (payment.status === 'VOIDED') {
      throw new AppError(
        `Payment '${payment.id}' is voided. Voided authorizations cannot be captured.`,
        409,
      );
    }

    if (payment.status !== 'AUTHORIZED') {
      throw new AppError(
        `Payment '${payment.id}' is in status '${payment.status}'. Only payments in 'AUTHORIZED' status can be captured.`,
        400,
      );
    }

    if (!payment.paypalAuthorizationId) {
      throw new AppError(
        `Payment '${payment.id}' does not have a recorded PayPal Authorization ID.`,
        400,
      );
    }
  }

  /**
   * Validates whether an authorization can be voided.
   */
  public static validateVoidEligibility(payment: TrackedPayment): void {
    if (payment.status === 'VOIDED') {
      throw new AppError(
        `Authorization '${payment.paypalAuthorizationId}' has already been voided.`,
        409,
      );
    }

    if (payment.status === 'CAPTURED') {
      throw new AppError(
        `Cannot void authorization '${payment.paypalAuthorizationId}' because it has already been captured.`,
        409,
      );
    }

    if (payment.status !== 'AUTHORIZED') {
      throw new AppError(
        `Cannot void payment in status '${payment.status}'. Expected 'AUTHORIZED'.`,
        400,
      );
    }

    if (!payment.paypalAuthorizationId) {
      throw new AppError(
        `Payment '${payment.id}' does not have a recorded PayPal Authorization ID.`,
        400,
      );
    }
  }
}
