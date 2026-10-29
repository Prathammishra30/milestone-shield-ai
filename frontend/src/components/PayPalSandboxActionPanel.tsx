import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  CreditCard,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Ban,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Milestone, SandboxTrackedPayment } from '../types';

interface PayPalSandboxActionPanelProps {
  milestone: Milestone;
  onPaymentChange?: () => void;
}

function isSafePayPalApproveUrl(urlStr?: string): boolean {
  if (!urlStr) return false;
  try {
    const u = new URL(urlStr);
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'www.sandbox.paypal.com' ||
        u.hostname === 'sandbox.paypal.com' ||
        u.hostname.endsWith('.paypal.com'))
    );
  } catch {
    return false;
  }
}

export default function PayPalSandboxActionPanel({
  milestone,
  onPaymentChange,
}: PayPalSandboxActionPanelProps) {
  const { sessionToken } = useAuth();
  const [trackedPayment, setTrackedPayment] = useState<SandboxTrackedPayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  }), [sessionToken]);

  // Modal / Confirm state for capture
  const [showCaptureConfirm, setShowCaptureConfirm] = useState(false);
  const [captureConfirmed, setCaptureConfirmed] = useState(false);
  const [operatorNote, setOperatorNote] = useState('Deliverable criteria verified; client approved release.');

  // Modal / Confirm state for void
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidConfirmed, setVoidConfirmed] = useState(false);
  const [voidReason, setVoidReason] = useState('Client requested cancellation of milestone.');

  // Fetch payment status from backend
  const fetchPaymentStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/paypal/milestone/${milestone.id}`, {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
      });
      if (res.ok) {
        const json = await res.json();
        setTrackedPayment(json.data);
      } else if (res.status === 404) {
        setTrackedPayment(null);
      }
    } catch (err) {
      console.warn('Could not fetch PayPal payment status:', err);
    }
  }, [milestone.id, sessionToken]);

  useEffect(() => {
    fetchPaymentStatus();
  }, [fetchPaymentStatus]);

  // Handle URL return params (e.g. ?paypal_return=true&token=...&milestoneId=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isReturn = params.get('paypal_return') === 'true';
    const isCancel = params.get('paypal_cancel') === 'true';
    const paramMilestoneId = params.get('milestoneId');
    const token = params.get('token');

    if (isReturn && token && (!paramMilestoneId || paramMilestoneId === milestone.id)) {
      setSuccessMessage(`PayPal checkout approved by buyer in Sandbox! Authorizing order ${token}...`);
      handleAuthorizeOrder(token);
      // Clean query params from URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (isCancel && (!paramMilestoneId || paramMilestoneId === milestone.id)) {
      setError('PayPal Sandbox checkout was cancelled by the buyer. You can re-initiate authorization when ready.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [milestone.id]);

  // ── 1. Create Orders v2 with Intent AUTHORIZE ─────────────────────
  const handleCreateOrder = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?paypal_return=true&milestoneId=${encodeURIComponent(milestone.id)}`;
      const cancelUrl = `${window.location.origin}${window.location.pathname}?paypal_cancel=true&milestoneId=${encodeURIComponent(milestone.id)}`;

      const res = await fetch(`/api/milestones/${milestone.id}/paypal/order`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ returnUrl, cancelUrl }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create PayPal order');
      }

      setSuccessMessage(`PayPal Sandbox order created (${data.data.orderId}). Click below to approve in Sandbox.`);
      await fetchPaymentStatus();
      onPaymentChange?.();

      if (data.data.approveUrl) {
        try {
          const parsedUrl = new URL(data.data.approveUrl);
          if (
            parsedUrl.protocol === 'https:' &&
            (parsedUrl.hostname === 'www.sandbox.paypal.com' ||
              parsedUrl.hostname === 'sandbox.paypal.com' ||
              parsedUrl.hostname.endsWith('.paypal.com'))
          ) {
            window.open(data.data.approveUrl, '_blank', 'noopener,noreferrer');
          } else {
            console.error('Refused to open untrusted approval URL scheme or host');
          }
        } catch {
          console.error('Invalid approval URL received from server');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // ── 2. Authorize Order ────────────────────────────────────────────
  const handleAuthorizeOrder = async (orderId?: string) => {
    const targetOrderId = orderId || trackedPayment?.paypalOrderId;
    if (!targetOrderId) {
      setError('No PayPal order ID found to authorize.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/payments/paypal/orders/${targetOrderId}/authorize`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to authorize PayPal order');
      }

      setSuccessMessage(`Order authorized successfully in PayPal Sandbox! Authorization ID: ${data.data.authorizationId}`);
      await fetchPaymentStatus();
      onPaymentChange?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // ── 3. Explicit Operator Capture ──────────────────────────────────
  const handleCaptureAuthorization = async () => {
    if (!trackedPayment?.paypalAuthorizationId) {
      setError('No PayPal Authorization ID available to capture.');
      return;
    }

    if (!captureConfirmed) {
      setError('You must explicitly confirm milestone acceptance before capturing.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/payments/paypal/authorizations/${trackedPayment.paypalAuthorizationId}/capture`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            confirmed: true,
            operatorNote,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to capture PayPal authorization');
      }

      setSuccessMessage(`Payment captured successfully in PayPal Sandbox! Capture ID: ${data.data.captureId}`);
      setShowCaptureConfirm(false);
      setCaptureConfirmed(false);
      await fetchPaymentStatus();
      onPaymentChange?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // ── 4. Guarded Void ───────────────────────────────────────────────
  const handleVoidAuthorization = async () => {
    if (!trackedPayment?.paypalAuthorizationId) {
      setError('No PayPal Authorization ID available to void.');
      return;
    }

    if (!voidConfirmed) {
      setError('You must confirm voiding the authorization hold.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/payments/paypal/authorizations/${trackedPayment.paypalAuthorizationId}/void`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ reason: voidReason }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to void PayPal authorization');
      }

      setSuccessMessage('Authorization successfully voided in PayPal Sandbox. Test hold released.');
      setShowVoidConfirm(false);
      setVoidConfirmed(false);
      await fetchPaymentStatus();
      onPaymentChange?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const status = trackedPayment?.status;

  return (
    <div className="rounded-xl border border-[#CBD5E1] bg-[#FAF8F5] p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[#003087] p-1.5 text-white">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-editorial text-sm font-bold text-ink-900">
                PayPal Sandbox Payment Lifecycle
              </h4>
              <span className="rounded bg-[#003087]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#003087]">
                SANDBOX REST v2
              </span>
            </div>
            <p className="text-[11px] text-ink-500">
              Orders v2 Authorization Intent & Policy-Guarded Capture
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div>
          {status === 'ORDER_CREATED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-semibold text-[#92400E]">
              <Clock className="h-3 w-3" /> Order Created — Awaiting Approval
            </span>
          )}
          {status === 'AUTHORIZED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF2EE] px-2.5 py-1 text-xs font-semibold text-[#1E4334]">
              <Lock className="h-3 w-3" /> PayPal Authorized — Not Captured
            </span>
          )}
          {status === 'CAPTURED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2.5 py-1 text-xs font-semibold text-[#065F46]">
              <CheckCircle2 className="h-3 w-3" /> Captured in Sandbox
            </span>
          )}
          {status === 'VOIDED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FEE2E2] px-2.5 py-1 text-xs font-semibold text-[#991B1B]">
              <Ban className="h-3 w-3" /> Authorization Voided
            </span>
          )}
          {!status && (
            <span className="inline-flex items-center gap-1 rounded-full bg-canvas-subtle px-2.5 py-1 text-xs font-medium text-ink-600 border border-border-subtle">
              Not Initiated
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">PayPal Operation Message:</p>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-xs text-[#065F46]">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{successMessage}</p>
        </div>
      )}

      {/* Body Details Based on Current State */}
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-lg border border-border-subtle bg-surface p-3">
          <div>
            <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
              Trusted Milestone Amount:
            </span>
            <p className="font-editorial text-base font-bold text-ink-900 mt-0.5">
              ${milestone.amount.toLocaleString()} USD
            </p>
            <p className="text-[10px] text-ink-400">Derived strictly from server-side milestone model</p>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
              Active Authorization Intent:
            </span>
            <p className="font-mono text-xs font-bold text-ink-800 mt-1">INTENT = AUTHORIZE</p>
            <p className="text-[10px] text-ink-400">Funds remain with client until explicit capture</p>
          </div>

          {trackedPayment?.paypalOrderId && (
            <div>
              <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                PayPal Order ID:
              </span>
              <p className="font-mono text-xs text-ink-800 mt-0.5 select-all">
                {trackedPayment.paypalOrderId}
              </p>
            </div>
          )}

          {trackedPayment?.paypalAuthorizationId && (
            <div>
              <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                Authorization ID:
              </span>
              <p className="font-mono text-xs text-ink-800 mt-0.5 select-all">
                {trackedPayment.paypalAuthorizationId}
              </p>
            </div>
          )}

          {trackedPayment?.paypalCaptureId && (
            <div>
              <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                Capture ID:
              </span>
              <p className="font-mono text-xs text-[#065F46] font-bold mt-0.5 select-all">
                {trackedPayment.paypalCaptureId}
              </p>
            </div>
          )}
        </div>

        {/* ── Action State 1: Not Started or Voided ── */}
        {(!status || status === 'VOIDED') && (
          <div className="space-y-2">
            <p className="text-ink-600 leading-relaxed">
              Initiate a PayPal Sandbox Orders v2 order with <code className="font-mono bg-canvas-subtle px-1 rounded">intent: 'AUTHORIZE'</code>. The amount (${milestone.amount} USD) is strictly derived from trusted server-side milestone data.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleCreateOrder}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#003087] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#002266] transition-colors disabled:opacity-50 shadow-2xs"
              >
                {loading ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                <span>Authorize Milestone via PayPal Sandbox</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Action State 2: Order Created ── */}
        {status === 'ORDER_CREATED' && (
          <div className="space-y-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[#92400E]">
            <p className="font-medium">
              Order created in PayPal Sandbox. The buyer must log in to PayPal Sandbox and approve the authorization hold.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {trackedPayment?.approveUrl && isSafePayPalApproveUrl(trackedPayment.approveUrl) && (
                <a
                  href={trackedPayment.approveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#003087] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#002266]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open PayPal Sandbox Approval Page</span>
                </a>
              )}
              <button
                onClick={() => handleAuthorizeOrder()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-canvas-subtle disabled:opacity-50"
              >
                {loading ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                <span>Check / Authorize Approved Order</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Action State 3: Authorized (Ready for Capture or Void) ── */}
        {status === 'AUTHORIZED' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[#C7DDD1] bg-[#EAF2EE] p-3 text-xs text-[#1E4334]">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                <span>Funds Successfully Authorized in PayPal Sandbox</span>
              </p>
              <p className="mt-1 leading-relaxed">
                A temporary hold for <strong>${milestone.amount.toLocaleString()} USD</strong> is placed on the client&apos;s Sandbox payment method. Funds have <strong>NOT</strong> been moved or captured.
              </p>
            </div>

            {/* Confirmation Controls */}
            {!showCaptureConfirm && !showVoidConfirm && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => setShowCaptureConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#1E4334] px-4 py-2 text-xs font-semibold text-white hover:bg-[#153126] transition-colors shadow-2xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Capture Authorized Payment (Live Sandbox)</span>
                </button>

                <button
                  onClick={() => setShowVoidConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#FCA5A5] bg-surface px-3 py-2 text-xs font-medium text-[#991B1B] hover:bg-[#FEF2F2] transition-colors"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span>Void Authorization (Release Hold)</span>
                </button>
              </div>
            )}

            {/* Explicit Capture Confirmation Card */}
            {showCaptureConfirm && (
              <div className="rounded-lg border border-[#244637] bg-surface p-4 shadow-sm space-y-3">
                <h5 className="font-editorial text-sm font-bold text-ink-900">
                  Confirm PayPal Sandbox Capture
                </h5>
                <p className="text-ink-600 leading-relaxed text-xs">
                  This executes a live capture call to PayPal Payments v2 (<code className="font-mono bg-canvas-subtle px-1">/v2/payments/authorizations/{trackedPayment?.paypalAuthorizationId}/capture</code>) using server-side client credentials.
                </p>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Operator Note / Audit Note:
                  </label>
                  <input
                    type="text"
                    value={operatorNote}
                    onChange={(e) => setOperatorNote(e.target.value)}
                    className="w-full rounded border border-border-default bg-surface p-2 text-xs text-ink-900 focus:border-[#244637] focus:outline-hidden"
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={captureConfirmed}
                    onChange={(e) => setCaptureConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-border-default text-[#1E4334] focus:ring-[#1E4334]"
                  />
                  <span className="text-xs font-semibold text-ink-800">
                    I explicitly confirm that acceptance criteria for &quot;{milestone.title}&quot; are satisfied and authorize the release of ${milestone.amount.toLocaleString()} USD in PayPal Sandbox.
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                  <button
                    onClick={() => {
                      setShowCaptureConfirm(false);
                      setCaptureConfirmed(false);
                    }}
                    className="rounded border border-border-default bg-surface px-3 py-1.5 text-xs text-ink-700 hover:bg-canvas-subtle"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCaptureAuthorization}
                    disabled={!captureConfirmed || loading}
                    className="inline-flex items-center gap-1.5 rounded bg-[#1E4334] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#153126] disabled:opacity-50"
                  >
                    {loading && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
                    <span>Execute Sandbox Capture</span>
                  </button>
                </div>
              </div>
            )}

            {/* Void Confirmation Card */}
            {showVoidConfirm && (
              <div className="rounded-lg border border-[#FCA5A5] bg-surface p-4 shadow-sm space-y-3">
                <h5 className="font-editorial text-sm font-bold text-[#991B1B]">
                  Confirm Voiding Authorization Hold
                </h5>
                <p className="text-ink-600 leading-relaxed text-xs">
                  This calls PayPal Payments v2 (<code className="font-mono bg-canvas-subtle px-1">/v2/payments/authorizations/{trackedPayment?.paypalAuthorizationId}/void</code>) to release the temporary hold.
                </p>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-700 mb-1">
                    Void Reason:
                  </label>
                  <input
                    type="text"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    className="w-full rounded border border-border-default bg-surface p-2 text-xs text-ink-900 focus:border-[#244637] focus:outline-hidden"
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={voidConfirmed}
                    onChange={(e) => setVoidConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-border-default text-[#991B1B] focus:ring-[#991B1B]"
                  />
                  <span className="text-xs font-semibold text-ink-800">
                    Confirm releasing authorization hold in PayPal Sandbox.
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                  <button
                    onClick={() => {
                      setShowVoidConfirm(false);
                      setVoidConfirmed(false);
                    }}
                    className="rounded border border-border-default bg-surface px-3 py-1.5 text-xs text-ink-700 hover:bg-canvas-subtle"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVoidAuthorization}
                    disabled={!voidConfirmed || loading}
                    className="inline-flex items-center gap-1.5 rounded bg-[#991B1B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#7F1D1D] disabled:opacity-50"
                  >
                    {loading && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
                    <span>Execute Sandbox Void</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Action State 4: Captured ── */}
        {status === 'CAPTURED' && (
          <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-xs text-[#065F46] space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>Milestone Settled & Captured in PayPal Sandbox</span>
            </p>
            <p className="leading-relaxed">
              Payment was captured via PayPal REST Payments v2. Capture ID: <code className="font-mono font-bold select-all">{trackedPayment?.paypalCaptureId}</code>. This transaction is recorded in the sandbox ledger.
            </p>
          </div>
        )}
      </div>

      {/* Safety Notice Footer */}
      <div className="border-t border-border-subtle pt-2 text-[10px] text-ink-400">
        🛡️ <strong>Sandbox Safety Policy:</strong> All actions target the PayPal Sandbox environment (<code className="font-mono">api-m.sandbox.paypal.com</code>). Production accounts and live financial instruments are rejected. MilestoneShield AI is an AI-assisted milestone prototype, not a regulated escrow service.
      </div>
    </div>
  );
}
