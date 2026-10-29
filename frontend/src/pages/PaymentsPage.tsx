import { useState, useEffect, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef } from 'ag-grid-community';
import { ShieldCheck, Receipt, Landmark, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { samplePayments } from '../data/sampleData';
import type { PaymentRecord, SandboxTrackedPayment, PaymentStatus } from '../types';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function PaymentsPage() {
  const { sessionToken } = useAuth();
  const [livePayments, setLivePayments] = useState<SandboxTrackedPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLivePayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/paypal', {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        setLivePayments(data.data?.payments || []);
      }
    } catch (err) {
      console.warn('Could not load live sandbox payments:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchLivePayments();
  }, [fetchLivePayments]);

  const combinedPayments = useMemo<PaymentRecord[]>(() => {
    const convertedLive: PaymentRecord[] = livePayments.map((lp) => {
      let status: PaymentStatus = 'pending';
      if (lp.status === 'CAPTURED') status = 'captured';
      else if (lp.status === 'AUTHORIZED') status = 'authorized';
      else if (lp.status === 'VOIDED') status = 'voided';

      return {
        id: lp.id,
        referenceId: lp.id,
        projectName: lp.projectName,
        milestoneTitle: lp.milestoneTitle,
        amount: lp.amount,
        status,
        paypalOrderId: lp.paypalOrderId,
        timestamp: lp.updatedAt || lp.createdAt,
        note: `Sandbox ${lp.status} (Order: ${lp.paypalOrderId})`,
        isSandboxLive: true,
        paypalAuthorizationId: lp.paypalAuthorizationId,
        paypalCaptureId: lp.paypalCaptureId,
      };
    });

    const sampleWithFlags = samplePayments.map((sp) => ({
      ...sp,
      isSandboxLive: false,
    }));

    return [...convertedLive, ...sampleWithFlags];
  }, [livePayments]);

  const columnDefs = useMemo<ColDef<PaymentRecord>[]>(
    () => [
      {
        headerName: 'Reference',
        field: 'referenceId',
        flex: 1.2,
        minWidth: 170,
        cellRenderer: (params: { data?: PaymentRecord; value?: string }) => {
          const isLive = params.data?.isSandboxLive;
          return (
            <div className="flex items-center gap-1.5 py-1">
              <span className="font-mono text-xs font-semibold text-ink-900">
                {params.data?.id || params.value}
              </span>
              {isLive ? (
                <span className="rounded bg-[#EBF3FC] px-1.5 py-0.5 text-[9px] font-bold text-[#1E4E8C] border border-[#BFDBFE]">
                  SANDBOX LIVE
                </span>
              ) : (
                <span className="rounded bg-canvas-subtle px-1.5 py-0.5 text-[9px] font-medium text-ink-500 border border-border-subtle">
                  SAMPLE
                </span>
              )}
            </div>
          );
        },
      },
      {
        headerName: 'Contract & Milestone',
        field: 'milestoneTitle',
        flex: 1.8,
        minWidth: 200,
        cellRenderer: (params: { data?: PaymentRecord; value?: string }) => (
          <div className="py-1">
            <p className="font-semibold text-xs text-ink-900 truncate">{params.value}</p>
            <p className="text-[11px] text-ink-500 truncate">{params.data?.projectName}</p>
          </div>
        ),
      },
      {
        headerName: 'Amount (USD)',
        field: 'amount',
        flex: 0.8,
        minWidth: 110,
        valueFormatter: (params: { value?: number }) =>
          params.value != null ? `$${Number(params.value).toLocaleString()}` : '',
        cellClass: 'font-editorial font-bold text-ink-900',
      },
      {
        headerName: 'Settlement Status',
        field: 'status',
        flex: 1.3,
        minWidth: 180,
        cellRenderer: (params: { data?: PaymentRecord; value?: string }) => {
          const val = params.value ?? 'pending';
          const isLive = params.data?.isSandboxLive;

          let label = val;
          let variant: 'forest' | 'ochre' | 'crimson' = 'ochre';

          if (val === 'captured') {
            label = isLive ? 'Captured in PayPal Sandbox' : 'Captured in demo data';
            variant = 'forest';
          } else if (val === 'authorized') {
            label = 'PayPal authorized — not captured';
            variant = 'ochre';
          } else if (val === 'voided') {
            label = 'Voided in Sandbox';
            variant = 'crimson';
          }

          return StatusBadge({ label, variant });
        },
      },
      {
        headerName: 'PayPal Order ID',
        field: 'paypalOrderId',
        flex: 1.4,
        minWidth: 190,
        valueFormatter: (params: { value?: string | null }) => params.value ?? '—',
        cellClass: 'font-mono text-[11px] text-ink-600',
      },
      {
        headerName: 'Recorded Date',
        field: 'timestamp',
        flex: 0.8,
        minWidth: 110,
        valueFormatter: (params: { value?: string }) =>
          params.value ? new Date(params.value).toLocaleDateString() : '',
        cellClass: 'text-xs text-ink-500',
      },
    ],
    [],
  );

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
    }),
    [],
  );

  const totalCaptured = combinedPayments
    .filter((p) => p.status === 'captured')
    .reduce((sum, p) => sum + p.amount, 0);

  const liveAuthorized = combinedPayments
    .filter((p) => p.isSandboxLive && p.status === 'authorized')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-5">
        <div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
            Payment Ledger & Sandbox Transactions
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Transaction history connecting live PayPal Sandbox responses with sample reference records.
          </p>
        </div>
        <button
          onClick={fetchLivePayments}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-canvas-subtle disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border-default bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1E4334]">
              Total Captured
            </span>
            <Receipt className="h-4 w-4 text-[#1E4334]" />
          </div>
          <p className="mt-2 font-editorial text-2xl font-bold text-[#1E4334]">
            ${totalCaptured.toLocaleString()} USD
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            {livePayments.filter((p) => p.status === 'CAPTURED').length} live Sandbox + {samplePayments.length} sample records
          </p>
        </div>

        <div className="rounded-xl border border-border-default bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#915416]">
              PayPal authorized — not captured
            </span>
            <Clock className="h-4 w-4 text-[#915416]" />
          </div>
          <p className="mt-2 font-editorial text-2xl font-bold text-[#915416]">
            ${(3500 + liveAuthorized).toLocaleString()} USD
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            {liveAuthorized > 0 ? `$${liveAuthorized.toLocaleString()} live Sandbox authorization active` : 'Milestone 2 awaiting review'}
          </p>
        </div>

        <div className="rounded-xl border border-border-default bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-600">
              Payment Gateway
            </span>
            <Landmark className="h-4 w-4 text-ink-500" />
          </div>
          <p className="mt-2 font-editorial text-2xl font-bold text-ink-900">
            PayPal Sandbox
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            REST API v2 (api-m.sandbox.paypal.com)
          </p>
        </div>
      </div>

      {/* AG Grid Table Container */}
      <div className="rounded-xl border border-border-default bg-surface p-1 shadow-xs">
        <div className="ag-theme-custom overflow-hidden rounded-lg" style={{ height: 380 }}>
          <AgGridReact<PaymentRecord>
            rowData={combinedPayments}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows={false}
            rowHeight={52}
            headerHeight={44}
            domLayout="normal"
          />
        </div>
      </div>

      {/* Prototype & Security Disclaimer */}
      <div className="rounded-lg border border-[#F1D6B3] bg-[#FEF9F2] p-4 text-xs text-[#8A4F12] space-y-1.5">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-[#915416]" />
          <span>PayPal Sandbox Security & Settlement Policy</span>
        </div>
        <p className="leading-relaxed">
          <strong>⚠️ Test Notice:</strong> Live Sandbox transactions above are executed in the PayPal Sandbox developer environment. Sample rows are historical demonstration data. In production, payments are authorized at milestone kickoff (not captured), remaining with the payment provider until explicit client sign-off verified by the backend policy engine. MilestoneShield AI is an AI-assisted prototype, not a bank or regulated escrow service.
        </p>
      </div>
    </div>
  );
}
