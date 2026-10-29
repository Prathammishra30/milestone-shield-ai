/**
 * PayPal Sandbox REST API Client
 *
 * SAFETY & COMPLIANCE REQUIREMENTS:
 * 1. Sandbox Only: All requests target the PayPal Sandbox environment (api-m.sandbox.paypal.com).
 *    Production endpoints are strictly rejected.
 * 2. Intent = AUTHORIZE: Milestone orders must use authorization intent. Funds remain with
 *    the payment provider and are not captured until explicit human operator confirmation.
 * 3. Redacted Logging: Secrets, bearer tokens, and buyer authorization keys are redacted.
 * 4. Idempotency: All mutating endpoints send `PayPal-Request-Id` to guarantee idempotent retries.
 */

import { env, reloadEnv } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export interface PayPalOAuthTokenResponse {
  scope: string;
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
}

export interface PayPalLinkDescription {
  href: string;
  rel: string;
  method?: string;
}

export interface PayPalCreateOrderResponse {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  links: PayPalLinkDescription[];
}

export interface PayPalAuthorizeOrderResponse {
  id: string;
  status: 'COMPLETED' | 'PENDING';
  purchase_units?: Array<{
    reference_id?: string;
    payments?: {
      authorizations?: Array<{
        id: string;
        status: 'CREATED' | 'CAPTURED' | 'DENIED' | 'EXPIRED' | 'PARTIALLY_CAPTURED' | 'VOIDED' | 'PENDING' | 'AUTHORIZED';
        amount: {
          currency_code: string;
          value: string;
        };
        seller_protection?: {
          status: string;
        };
        expiration_time?: string;
        links?: PayPalLinkDescription[];
      }>;
    };
  }>;
}

export interface PayPalCaptureResponse {
  id: string;
  status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'REFUNDED';
  amount: {
    currency_code: string;
    value: string;
  };
  final_capture?: boolean;
  seller_protection?: {
    status: string;
  };
  links?: PayPalLinkDescription[];
}

export interface PayPalErrorDetail {
  field?: string;
  value?: string;
  location?: string;
  issue: string;
  description: string;
}

export interface PayPalApiErrorResponse {
  name: string;
  message: string;
  debug_id?: string;
  details?: PayPalErrorDetail[];
  links?: PayPalLinkDescription[];
}

class PayPalClient {
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private readonly defaultTimeoutMs = 10000;

  /**
   * Helper to redact sensitive values from logging output.
   */
  public redact(value: string | undefined): string {
    if (!value) return '[EMPTY]';
    if (value.length <= 8) return '***';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  /**
   * Retrieves an OAuth 2.0 access token using client credentials grant.
   * Caches token in memory until 60 seconds before expiration.
   */
  public async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    const clientId = env.PAYPAL_CLIENT_ID?.trim() || '';
    const clientSecret = env.PAYPAL_CLIENT_SECRET?.trim() || '';

    if (!clientId || !clientSecret) {
      throw new AppError(
        'PayPal Sandbox credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env',
        500,
      );
    }

    if (clientId.startsWith('YOUR_') || clientSecret.startsWith('YOUR_')) {
      throw new AppError(
        'PayPal Sandbox credentials in backend/.env are set to placeholder values (YOUR_...). Please replace them with your actual PayPal Sandbox Client ID and Client Secret from developer.paypal.com.',
        500,
      );
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = `${env.PAYPAL_BASE_URL}/v1/oauth2/token`;

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(this.defaultTimeoutMs),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          `[PayPalClient] OAuth token request failed with HTTP ${response.status}:`,
          errorBody,
        );

        let errorDetail = '';
        try {
          const json = JSON.parse(errorBody);
          if (json.error_description) {
            errorDetail = ` (${json.error}: ${json.error_description})`;
          } else if (json.message) {
            errorDetail = ` (${json.message})`;
          }
        } catch {
          // Response body was not JSON
        }

        throw new AppError(
          `PayPal OAuth authorization failed: HTTP ${response.status}${errorDetail}. Verify PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env`,
          502,
        );
      }

      const data = (await response.json()) as PayPalOAuthTokenResponse;
      this.cachedToken = data.access_token;
      this.tokenExpiresAt = now + data.expires_in * 1000;

      return this.cachedToken;
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new AppError(`PayPal OAuth connection error: ${message}`, 502);
    }
  }

  /**
   * Clears the cached token (useful for test suites).
   */
  public clearCachedToken(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Creates a PayPal Orders v2 order with intent=AUTHORIZE.
   */
  public async createAuthorizeOrder(params: {
    milestoneId: string;
    milestoneTitle: string;
    amount: number;
    currency: string;
    returnUrl?: string;
    cancelUrl?: string;
    idempotencyKey?: string;
  }): Promise<{
    orderId: string;
    status: string;
    approveUrl: string;
    links: PayPalLinkDescription[];
  }> {
    const token = await this.getAccessToken();
    const idempotencyKey = params.idempotencyKey || `ord-${params.milestoneId}-${Date.now()}`;

    const defaultReturnUrl = `${env.CORS_ORIGIN}/overview?paypal_return=true&milestoneId=${encodeURIComponent(params.milestoneId)}`;
    const defaultCancelUrl = `${env.CORS_ORIGIN}/overview?paypal_cancel=true&milestoneId=${encodeURIComponent(params.milestoneId)}`;

    const payload = {
      intent: 'AUTHORIZE',
      purchase_units: [
        {
          reference_id: params.milestoneId,
          description: `MilestoneShield AI: ${params.milestoneTitle.slice(0, 120)}`,
          custom_id: params.milestoneId,
          amount: {
            currency_code: params.currency,
            value: params.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'MilestoneShield AI (Sandbox)',
        landing_page: 'NO_PREFERENCE',
        user_action: 'CONTINUE',
        return_url: params.returnUrl || defaultReturnUrl,
        cancel_url: params.cancelUrl || defaultCancelUrl,
      },
    };

    const url = `${env.PAYPAL_BASE_URL}/v2/checkout/orders`;

    const response = await this.makeAuthorizedRequest<PayPalCreateOrderResponse>(url, {
      method: 'POST',
      token,
      body: payload,
      idempotencyKey,
    });

    const approveLink = response.links?.find(
      (l) => l.rel === 'approve' || l.rel === 'payer-action',
    )?.href;

    if (!approveLink) {
      throw new AppError(
        'PayPal Sandbox created order but did not return a buyer approval link (rel="approve")',
        502,
      );
    }

    return {
      orderId: response.id,
      status: response.status,
      approveUrl: approveLink,
      links: response.links,
    };
  }

  /**
   * Authorizes an approved order in PayPal Orders v2.
   */
  public async authorizeOrder(
    orderId: string,
    idempotencyKey?: string,
  ): Promise<{
    orderId: string;
    authorizationId: string;
    status: string;
    amount: { currency_code: string; value: string };
    expirationTime?: string;
  }> {
    const token = await this.getAccessToken();
    const key = idempotencyKey || `auth-${orderId}-${Date.now()}`;
    const url = `${env.PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`;

    const response = await this.makeAuthorizedRequest<PayPalAuthorizeOrderResponse>(url, {
      method: 'POST',
      token,
      body: {},
      idempotencyKey: key,
    });

    const authorization = response.purchase_units?.[0]?.payments?.authorizations?.[0];

    if (!authorization || !authorization.id) {
      throw new AppError(
        `PayPal order authorization succeeded with status '${response.status}', but no authorization record was returned`,
        502,
      );
    }

    return {
      orderId: response.id,
      authorizationId: authorization.id,
      status: authorization.status || 'AUTHORIZED',
      amount: authorization.amount,
      expirationTime: authorization.expiration_time,
    };
  }

  /**
   * Captures an authorized payment via PayPal Payments v2.
   * Requires explicit operator sign-off.
   */
  public async captureAuthorization(
    authorizationId: string,
    params: {
      note?: string;
      idempotencyKey?: string;
    } = {},
  ): Promise<{
    captureId: string;
    status: string;
    amount: { currency_code: string; value: string };
  }> {
    const token = await this.getAccessToken();
    const key = params.idempotencyKey || `cap-${authorizationId}-${Date.now()}`;
    const url = `${env.PAYPAL_BASE_URL}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`;

    const payload = {
      final_capture: true,
      note_to_payer: params.note || 'Milestone verification approved on MilestoneShield AI.',
    };

    const response = await this.makeAuthorizedRequest<PayPalCaptureResponse>(url, {
      method: 'POST',
      token,
      body: payload,
      idempotencyKey: key,
    });

    return {
      captureId: response.id,
      status: response.status,
      amount: response.amount,
    };
  }

  /**
   * Voids an uncaptured authorization via PayPal Payments v2.
   */
  public async voidAuthorization(
    authorizationId: string,
    idempotencyKey?: string,
  ): Promise<{ authorizationId: string; status: 'VOIDED' }> {
    const token = await this.getAccessToken();
    const key = idempotencyKey || `void-${authorizationId}-${Date.now()}`;
    const url = `${env.PAYPAL_BASE_URL}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`;

    await this.makeAuthorizedRequest<void>(url, {
      method: 'POST',
      token,
      body: {},
      idempotencyKey: key,
    });

    return {
      authorizationId,
      status: 'VOIDED',
    };
  }

  /**
   * Reads order details from PayPal Orders v2.
   */
  public async getOrderDetails(orderId: string): Promise<Record<string, unknown>> {
    const token = await this.getAccessToken();
    const url = `${env.PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}`;

    return this.makeAuthorizedRequest<Record<string, unknown>>(url, {
      method: 'GET',
      token,
    });
  }

  /**
   * Verifies a PayPal webhook signature by calling the PayPal
   * POST /v1/notifications/verify-webhook-signature endpoint.
   *
   * PayPal validates that the transmission headers and event payload
   * match its cryptographic certificate. This is the documented
   * server-side verification method recommended by PayPal.
   *
   * NOTE: This endpoint does NOT work with PayPal Webhook Simulator events;
   * it only validates real webhook deliveries from PayPal's infrastructure.
   *
   * @returns 'SUCCESS' if PayPal confirms the signature, 'FAILURE' otherwise.
   */
  public async verifyWebhookSignature(params: {
    authAlgo: string;
    certUrl: string;
    transmissionId: string;
    transmissionSig: string;
    transmissionTime: string;
    webhookId: string;
    webhookEvent: Record<string, unknown>;
  }): Promise<{ verificationStatus: 'SUCCESS' | 'FAILURE' }> {
    const token = await this.getAccessToken();
    const url = `${env.PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`;

    const payload = {
      auth_algo: params.authAlgo,
      cert_url: params.certUrl,
      transmission_id: params.transmissionId,
      transmission_sig: params.transmissionSig,
      transmission_time: params.transmissionTime,
      webhook_id: params.webhookId,
      webhook_event: params.webhookEvent,
    };

    const response = await this.makeAuthorizedRequest<{
      verification_status: 'SUCCESS' | 'FAILURE';
    }>(url, {
      method: 'POST',
      token,
      body: payload,
    });

    return {
      verificationStatus: response.verification_status,
    };
  }

  /**
   * Reads authorization details from PayPal Payments v2.
   */
  public async getAuthorizationDetails(authorizationId: string): Promise<Record<string, unknown>> {
    const token = await this.getAccessToken();
    const url = `${env.PAYPAL_BASE_URL}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}`;

    return this.makeAuthorizedRequest<Record<string, unknown>>(url, {
      method: 'GET',
      token,
    });
  }

  /**
   * Generic authenticated HTTP request executor with error parsing and timeout protection.
   */
  private async makeAuthorizedRequest<T>(
    url: string,
    options: {
      method: 'GET' | 'POST';
      token: string;
      body?: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (options.idempotencyKey) {
      headers['PayPal-Request-Id'] = options.idempotencyKey;
    }

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(this.defaultTimeoutMs),
      });

      // HTTP 204 No Content (standard response for PayPal void)
      if (response.status === 204) {
        return undefined as unknown as T;
      }

      if (!response.ok) {
        let errorData: PayPalApiErrorResponse | null = null;
        try {
          errorData = (await response.json()) as PayPalApiErrorResponse;
        } catch {
          // Response body was not JSON
        }

        const debugId = errorData?.debug_id ? ` (PayPal Debug ID: ${errorData.debug_id})` : '';
        const detailMsg = errorData?.details?.[0]
          ? ` - ${errorData.details[0].issue}: ${errorData.details[0].description}`
          : '';
        const summary = errorData?.message || errorData?.name || `HTTP ${response.status}`;

        throw new AppError(
          `PayPal Sandbox API error: ${summary}${detailMsg}${debugId}`,
          response.status >= 500 ? 502 : response.status,
        );
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new AppError(`PayPal Sandbox API connection failed: ${message}`, 502);
    }
  }
}

export const paypalClient = new PayPalClient();
