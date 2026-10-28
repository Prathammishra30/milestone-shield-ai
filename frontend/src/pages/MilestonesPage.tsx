import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef } from 'ag-grid-community';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import StatusBadge, { milestoneVariant } from '../components/StatusBadge';
import { sampleMilestones } from '../data/sampleData';
import type { Milestone } from '../types';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function MilestonesPage() {
  const [filter, setFilter] = useState<string>('all');

  const filteredData = useMemo(() => {
    if (filter === 'all') return sampleMilestones;
    return sampleMilestones.filter((m) => m.status === filter);
  }, [filter]);

  const columnDefs = useMemo<ColDef<Milestone>[]>(
    () => [
      {
        headerName: 'Milestone',
        field: 'title',
        flex: 2,
        minWidth: 220,
        cellRenderer: (params: { data?: Milestone; value?: string }) => {
          return (
            <div className="py-1">
              <p className="font-semibold text-xs text-ink-900 leading-tight">{params.value}</p>
              <p className="text-[11px] text-ink-500 truncate">{params.data?.projectName}</p>
            </div>
          );
        },
      },
      {
        headerName: 'Amount (USD)',
        field: 'amount',
        flex: 0.8,
        minWidth: 120,
        valueFormatter: (params: { value?: number }) =>
          params.value != null ? `$${Number(params.value).toLocaleString()}` : '',
        cellClass: 'font-editorial font-bold text-ink-900',
      },
      {
        headerName: 'Due Date',
        field: 'dueDate',
        flex: 0.8,
        minWidth: 110,
        valueFormatter: (params: { value?: string }) =>
          params.value ? new Date(params.value).toLocaleDateString() : '',
        cellClass: 'text-xs text-ink-600',
      },
      {
        headerName: 'Status',
        field: 'status',
        flex: 0.9,
        minWidth: 130,
        cellRenderer: (params: { value?: string }) => {
          const val = params.value ?? 'pending';
          return StatusBadge({ label: val.replace('_', ' '), variant: milestoneVariant(val) });
        },
      },
      {
        headerName: 'Criteria',
        field: 'acceptanceCriteria',
        flex: 1,
        minWidth: 120,
        valueFormatter: (params: { value?: string[] }) =>
          params.value ? `${params.value.length} criteria defined` : 'None',
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border-default pb-5">
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
          Milestones & Acceptance Criteria
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Deliverable schedules, performance thresholds, and verification records across all active contracts.
          <span className="ml-1 text-ink-400">(Sample data)</span>
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All Milestones' },
          { id: 'submitted', label: 'In Review' },
          { id: 'in_progress', label: 'In Progress' },
          { id: 'paid', label: 'Settled & Paid' },
          { id: 'pending', label: 'Pending Start' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === id
                ? 'bg-[#12241C] text-[#FAF8F5]'
                : 'border border-border-default bg-surface text-ink-700 hover:bg-canvas-subtle'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* AG Grid Table Container */}
      <div className="rounded-xl border border-border-default bg-surface p-1 shadow-xs">
        <div className="ag-theme-custom overflow-hidden rounded-lg" style={{ height: 380 }}>
          <AgGridReact<Milestone>
            rowData={filteredData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows={false}
            rowHeight={52}
            headerHeight={44}
            domLayout="normal"
          />
        </div>
      </div>

      {/* Acceptance Criteria Cards */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-editorial text-lg font-bold text-ink-900">
            Acceptance Criteria Specifications
          </h2>
          <span className="text-xs text-ink-500">
            {sampleMilestones.length} active milestone criteria sets
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sampleMilestones.map((ms) => (
            <div
              key={ms.id}
              className="rounded-xl border border-border-default bg-surface p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] text-ink-400">CTR-{ms.projectId}</span>
                  <h3 className="font-editorial text-base font-bold text-ink-900">{ms.title}</h3>
                  <p className="text-xs text-ink-500">{ms.projectName}</p>
                </div>
                <StatusBadge label={ms.status.replace('_', ' ')} variant={milestoneVariant(ms.status)} />
              </div>

              <p className="text-xs text-ink-600 leading-relaxed">{ms.description}</p>

              <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">
                  Measurable Criteria:
                </p>
                <ul className="space-y-1.5">
                  {ms.criteriaChecks?.map((chk) => (
                    <li key={chk.id} className="flex items-start gap-2 text-xs text-ink-700">
                      {chk.status === 'met' ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#244637]" />
                      ) : chk.status === 'incomplete' ? (
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#CD7B22]" />
                      ) : (
                        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                      )}
                      <span>{chk.criterion}</span>
                    </li>
                  )) ||
                    ms.acceptanceCriteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-ink-700">
                        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                        <span>{c}</span>
                      </li>
                    ))}
                </ul>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-editorial font-bold text-ink-900">
                  ${ms.amount.toLocaleString()} USD
                </span>
                <span className="text-[11px] text-ink-500">
                  Due {new Date(ms.dueDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
