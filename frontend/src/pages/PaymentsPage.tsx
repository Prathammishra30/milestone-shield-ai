import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef } from 'ag-grid-community';
import { ShieldCheck, Receipt, Landmark, Clock } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { samplePayments } from '../data/sampleData';
import type { PaymentRecord } from '../types';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function PaymentsPage() {
  const columnDefs = useMemo<ColDef<PaymentRecord>[]>(
    () => [
      {
        headerName: 'Sample Reference',
        field: 'referenceId',
        flex: 0.9,
        minWidth: 140,
        valueFormatter: (params: { data?: PaymentRecord; value?: string }) =>
          params.value || params.data?.id || '—',
        cellClass: 'font-mono text-xs font-semibold text-ink-900',
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
        headerName: 'Settlement Status (Sample)',
        field: 'status',
        flex: 1.1,
        minWidth: 150,
        cellRenderer: (params: { value?: string }) => {
          const val = params.value ?? 'pending';
          const label = val === 'captured' ? 'Captured in demo data' : val;
          return StatusBadge({ label, variant: val === 'captured' ? 'forest' : 'ochre' });
        },
      },
      {
        headerName: 'Sample PayPal Order ID',
        field: 'paypalOrderId',
        flex: 1.3,
        minWidth: 170,
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

  const totalCaptured = samplePayments
    .filter((p) => p.status === 'captured')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border-default pb-5">
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
          Payment Ledger & Sandbox Transactions
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Transaction history and simulated payment authorization/capture state transitions.
          <span className="ml-1 text-ink-400">(Sample demonstration data only)</span>
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border-default bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1E4334]">
              Total Captured in Demo Data
            </span>
            <Receipt className="h-4 w-4 text-[#1E4334]" />
          </div>
          <p className="mt-2 font-editorial text-2xl font-bold text-[#1E4334]">
            ${totalCaptured.toLocaleString()} USD
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            Across {samplePayments.length} sample milestone records
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
            $3,500 USD
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            Milestone 2 awaiting acceptance review in active demo contract
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
            REST API v2 (Simulation Mode — No Real Funds)
          </p>
        </div>
      </div>

      {/* AG Grid Table Container */}
      <div className="rounded-xl border border-border-default bg-surface p-1 shadow-xs">
        <div className="ag-theme-custom overflow-hidden rounded-lg" style={{ height: 340 }}>
          <AgGridReact<PaymentRecord>
            rowData={samplePayments}
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
          <strong>⚠️ Sample Data Only:</strong> The transaction references and PayPal Order IDs shown above are demonstration placeholders. No real monetary transactions or banking withdrawals have occurred. In production, payments are authorized at milestone kickoff (not captured), remaining with the payment provider until explicit client sign-off verified by the backend policy engine. MilestoneShield AI is an AI-assisted prototype, not a bank or regulated escrow service.
        </p>
      </div>
    </div>
  );
}
