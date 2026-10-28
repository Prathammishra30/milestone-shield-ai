import { useState, useMemo } from 'react';
import {
  FileText,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building2,
  User,
  Scale,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import StatusBadge, { milestoneVariant } from '../components/StatusBadge';
import ReviewActionModal, { type ModalType } from '../components/ReviewActionModal';
import {
  sampleProjects,
  sampleMilestones as initialMilestones,
  samplePayments,
  getContractSummary,
} from '../data/sampleData';
import type { Milestone, MilestoneStatus } from '../types';

export default function OverviewPage() {
  const [project] = useState(sampleProjects[0]);
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [selectedId, setSelectedId] = useState<string>('ms-002');
  const [activeFilter, setActiveFilter] = useState<'all' | 'submitted' | 'in_progress' | 'paid'>('all');
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filtered milestones
  const filteredMilestones = useMemo(() => {
    if (activeFilter === 'all') return milestones;
    return milestones.filter((m) => m.status === activeFilter);
  }, [milestones, activeFilter]);

  // Selected milestone
  const selectedMilestone = useMemo(() => {
    return milestones.find((m) => m.id === selectedId) || milestones[0];
  }, [milestones, selectedId]);

  // Dynamic financial summary based on local state (consistent mutually exclusive allocations)
  const summary = useMemo(() => {
    return getContractSummary(project, milestones);
  }, [project, milestones]);

  // Handle demo action
  const handleConfirmAction = (
    action: 'approved' | 'revision_requested' | 'escalated',
    note: string,
  ) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== selectedMilestone.id) return m;

        let nextStatus: MilestoneStatus = m.status;
        if (action === 'approved') nextStatus = 'approved';
        if (action === 'revision_requested') nextStatus = 'submitted';

        return {
          ...m,
          status: nextStatus,
          submissionDetails: m.submissionDetails
            ? {
                ...m.submissionDetails,
                reviewDecision: {
                  status: action,
                  decidedBy: 'Acme Retail Corp (Client Demo)',
                  decidedAt: new Date().toISOString(),
                  feedback: note,
                  auditRef: `SAMPLE-DEMO-AUDIT-${Math.floor(100000 + Math.random() * 900000)}`,
                },
              }
            : undefined,
        };
      }),
    );

    setModalType(null);
    const label =
      action === 'approved'
        ? 'Deliverable Approved (Local Demo State Updated)'
        : action === 'revision_requested'
        ? 'Revision Request Recorded (Local Demo State Updated)'
        : 'Escalation Recorded (Local Demo State Updated)';
    setToastMessage(`${label} — Safety Notice: This is a prototype simulation. No PayPal transaction or monetary movement was executed.`);
    setTimeout(() => setToastMessage(null), 7000);
  };

  const handleResetDemo = () => {
    setMilestones(initialMilestones);
    setToastMessage('Demo state reset to initial conditions.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-[#C7DDD1] bg-[#EAF2EE] p-3 text-xs font-medium text-[#1E4334] shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#244637]" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs font-semibold text-[#244637] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main Contract Header ───────────────────────────────────── */}
      <section className="rounded-xl border border-border-default bg-surface p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span className="font-mono text-ink-600">CTR-2026-0881 (Sample)</span>
              <span>·</span>
              <span>Started Sep 15, 2026</span>
              <span>·</span>
              <span>Target Delivery Dec 01, 2026</span>
            </div>

            <h1 className="mt-1.5 font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
              {project.name}
            </h1>

            {/* Counterparties */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-canvas-subtle px-2.5 py-1 text-ink-700">
                <Building2 className="h-3.5 w-3.5 text-ink-500" />
                <span className="font-semibold text-ink-900">{project.client}</span>
                <span className="text-[10px] text-ink-400">(Client Demo)</span>
              </div>

              <ArrowRight className="h-3 w-3 text-ink-400" />

              <div className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-canvas-subtle px-2.5 py-1 text-ink-700">
                <User className="h-3.5 w-3.5 text-ink-500" />
                <span className="font-semibold text-ink-900">{project.freelancer}</span>
                <span className="text-[10px] text-ink-400">(Freelancer Demo)</span>
              </div>

              <StatusBadge label="Active Contract" variant="forest" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => setModalType('message')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-canvas-subtle transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5 text-ink-500" />
              <span>Message Counterparty (Demo)</span>
            </button>

            <button
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface px-3 py-1.5 text-xs font-medium text-ink-500 hover:bg-canvas-subtle transition-colors"
              title="Reset demonstration state"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset Demo</span>
            </button>
          </div>
        </div>

        {/* ── Horizontal Contract Summary with Segmented Progress ────── */}
        <div className="mt-6 border-t border-border-subtle pt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Total Contract Value
              </p>
              <p className="mt-1 font-editorial text-2xl font-bold text-ink-900">
                ${summary.totalValue.toLocaleString()}
              </p>
              <p className="text-[10px] text-ink-400 mt-0.5">Full 4-milestone scope</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1E4334]">
                Released in sample ledger
              </p>
              <p className="mt-1 font-editorial text-2xl font-bold text-[#1E4334]">
                ${summary.releasedAmount.toLocaleString()}
              </p>
              <p className="text-[10px] text-[#2E5846] mt-0.5">
                {summary.releasedPercent.toFixed(1)}% · Settled in demo data
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#915416]">
                PayPal authorized — not captured
              </p>
              <p className="mt-1 font-editorial text-2xl font-bold text-[#915416]">
                ${summary.authorizedAmount.toLocaleString()}
              </p>
              <p className="text-[10px] text-[#915416] mt-0.5">
                {summary.authorizedPercent.toFixed(1)}% · Pending review
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Remaining unfunded
              </p>
              <p className="mt-1 font-editorial text-2xl font-bold text-ink-600">
                ${summary.unfundedAmount.toLocaleString()}
              </p>
              <p className="text-[10px] text-ink-400 mt-0.5">
                {summary.unfundedPercent.toFixed(1)}% · Unscheduled
              </p>
            </div>
          </div>

          {/* Segmented Progress Bar (Mutually Exclusive Consistent Allocations) */}
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-border-subtle flex">
              <div
                style={{ width: `${summary.releasedPercent}%` }}
                className="bg-[#244637] transition-all duration-300"
                title={`Released in sample ledger: $${summary.releasedAmount.toLocaleString()} (${summary.releasedPercent.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${summary.authorizedPercent}%` }}
                className="bg-[#CD7B22] transition-all duration-300"
                title={`PayPal authorized — not captured: $${summary.authorizedAmount.toLocaleString()} (${summary.authorizedPercent.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${summary.unfundedPercent}%` }}
                className="bg-border-default transition-all duration-300"
                title={`Remaining unfunded: $${summary.unfundedAmount.toLocaleString()} (${summary.unfundedPercent.toFixed(1)}%)`}
              />
            </div>

            {/* Legend */}
            <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-ink-600">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#244637]" />
                <span>Released in sample ledger (${summary.releasedAmount.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#CD7B22]" />
                <span>PayPal authorized — not captured (${summary.authorizedAmount.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-border-default" />
                <span>Remaining unfunded (${summary.unfundedAmount.toLocaleString()})</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Two-Column Workspace ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Milestone List (5 cols on desktop) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-editorial text-lg font-bold text-ink-900">
                Milestones ({milestones.length})
              </h2>
              <p className="text-xs text-ink-500">Select a milestone to review verification criteria</p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5 border-b border-border-subtle pb-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'submitted', label: 'In Review' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'paid', label: 'Completed' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveFilter(id as typeof activeFilter)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeFilter === id
                    ? 'bg-[#12241C] text-[#FAF8F5]'
                    : 'bg-surface text-ink-600 border border-border-default hover:bg-canvas-subtle'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Milestone Cards List */}
          <div className="space-y-3">
            {filteredMilestones.map((ms, index) => {
              const isSelected = ms.id === selectedMilestone.id;
              const msNumber = ms.milestoneNumber || index + 1;

              return (
                <div
                  key={ms.id}
                  onClick={() => setSelectedId(ms.id)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedId(ms.id);
                    }
                  }}
                  className={`group cursor-pointer rounded-lg border p-4 transition-all text-left ${
                    isSelected
                      ? 'border-[#244637] bg-surface shadow-xs ring-1 ring-[#244637]/20'
                      : 'border-border-default bg-surface hover:border-border-strong hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Milestone Number Badge */}
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold ${
                          isSelected
                            ? 'bg-[#1E4334] text-white'
                            : 'bg-canvas-subtle text-ink-600 border border-border-subtle'
                        }`}
                      >
                        {String(msNumber).padStart(2, '0')}
                      </span>

                      <div>
                        <h3 className="text-sm font-semibold text-ink-900 group-hover:text-[#1E4334]">
                          {ms.title}
                        </h3>
                        <p className="mt-1 text-xs text-ink-500 line-clamp-2 leading-relaxed">
                          {ms.description}
                        </p>
                      </div>
                    </div>

                    <StatusBadge
                      label={ms.status.replace('_', ' ')}
                      variant={milestoneVariant(ms.status)}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-xs">
                    <span className="font-editorial text-base font-bold text-ink-900">
                      ${ms.amount.toLocaleString()} USD
                    </span>
                    <span className="text-[11px] text-ink-500">
                      Due {new Date(ms.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Milestone Submission Review Panel (7 cols on desktop) */}
        <section className="lg:col-span-7">
          <div className="rounded-xl border border-border-default bg-surface p-6 shadow-xs space-y-6">
            {/* Header of review panel */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-border-subtle pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-ink-500 uppercase">
                    Milestone {selectedMilestone.milestoneNumber || '02'}
                  </span>
                  <span>·</span>
                  <StatusBadge
                    label={selectedMilestone.status.replace('_', ' ')}
                    variant={milestoneVariant(selectedMilestone.status)}
                    size="md"
                  />
                </div>
                <h2 className="mt-1 font-editorial text-xl sm:text-2xl font-bold text-ink-900">
                  {selectedMilestone.title}
                </h2>
                <p className="mt-1 text-xs text-ink-600 leading-relaxed">
                  {selectedMilestone.description}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[11px] font-medium text-ink-400 block uppercase tracking-wider">
                  Milestone Allocation
                </span>
                <span className="font-editorial text-2xl font-bold text-ink-900">
                  ${selectedMilestone.amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Criterion-by-Criterion Checks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  Acceptance Criteria Verification
                </h3>
                <span className="text-xs text-ink-500">
                  {selectedMilestone.criteriaChecks?.filter((c) => c.status === 'met').length ?? 0} of{' '}
                  {selectedMilestone.criteriaChecks?.length ?? selectedMilestone.acceptanceCriteria.length} Met
                </span>
              </div>

              <div className="space-y-3">
                {selectedMilestone.criteriaChecks?.map((check) => (
                  <div
                    key={check.id}
                    className="rounded-lg border border-border-subtle bg-canvas-subtle/60 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-start gap-2.5">
                      {check.status === 'met' && (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#244637]" />
                      )}
                      {check.status === 'incomplete' && (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#CD7B22]" />
                      )}
                      {check.status === 'pending' && (
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                      )}

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-ink-900">{check.criterion}</p>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                              check.status === 'met'
                                ? 'bg-[#EAF2EE] text-[#1E4334]'
                                : check.status === 'incomplete'
                                ? 'bg-[#FDF3E5] text-[#915416]'
                                : 'bg-[#F4EFE6] text-ink-500'
                            }`}
                          >
                            {check.status}
                          </span>
                        </div>

                        {check.evidence && (
                          <p className="mt-1 text-xs text-ink-600 bg-surface/70 rounded p-2 border border-border-subtle leading-relaxed">
                            <strong className="text-ink-700">Sample Evidence:</strong> {check.evidence}
                          </p>
                        )}
                        {check.notes && (
                          <p className="mt-1 text-[11px] text-ink-500 italic">
                            Note: {check.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )) || (
                  <ul className="space-y-2">
                    {selectedMilestone.acceptanceCriteria.map((crit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-ink-700">
                        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                        <span>{crit}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* AI Verification Analysis — Visibly Marked SIMULATED AI REVIEW */}
            {selectedMilestone.submissionDetails?.aiVerification && (
              <div className="rounded-lg border border-[#CD7B22]/30 bg-[#FEFBF6] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between border-b border-[#CD7B22]/20 pb-2.5 gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#915416]" />
                    <span className="font-bold text-xs uppercase tracking-wider text-[#915416]">
                      SIMULATED AI REVIEW — DEMO DATA
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-ink-700">
                      Simulated Score: {(selectedMilestone.submissionDetails.aiVerification.confidenceScore * 100).toFixed(0)}% (Demo)
                    </span>
                  </div>
                </div>

                {/* Explicit Transparency Notice */}
                <div className="rounded border border-[#F1D6B3] bg-[#FEF9F2] px-3 py-1.5 text-[11px] text-[#8A4F12]">
                  <strong>⚠️ AI Transparency Notice:</strong> No live Anthropic API was called. This criteria analysis and score are pre-computed mock data for prototype demonstration. Live Claude API integration is scheduled for Milestone 2.
                </div>

                <p className="text-xs text-ink-700 leading-relaxed">
                  {selectedMilestone.submissionDetails.aiVerification.summary}
                </p>

                {selectedMilestone.submissionDetails.aiVerification.missingRequirements.length > 0 && (
                  <div className="rounded border border-[#F1D6B3] bg-[#FEF9F2] p-2.5 text-xs text-[#8A4F12]">
                    <p className="font-semibold text-[11px] uppercase tracking-wide">
                      Simulated Criteria Findings:
                    </p>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      {selectedMilestone.submissionDetails.aiVerification.missingRequirements.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Submitted Deliverables / Artifacts (Demonstrative Sample Badges) */}
            {selectedMilestone.submissionDetails?.assets && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-700">
                    Submitted Deliverable Artifacts
                  </h3>
                  <span className="text-[10px] text-ink-500 font-medium">
                    (Sample Deliverables — Mock References)
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectedMilestone.submissionDetails.assets.map((asset, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-md border border-border-default bg-surface p-2.5 text-xs text-ink-800"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                        <span className="truncate font-medium">{asset.name}</span>
                      </div>
                      <span className="text-[10px] rounded bg-canvas-subtle px-1.5 py-0.5 text-ink-500 font-mono border border-border-subtle shrink-0">
                        Sample
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review Decision States & Action Controls */}
            <div className="rounded-lg border border-border-default bg-canvas-subtle p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  Review & Authorization Determination
                </span>
                <span className="text-[11px] text-ink-500">
                  PayPal Sandbox Authorization Gated — Demo Action
                </span>
              </div>

              {selectedMilestone.submissionDetails?.reviewDecision?.status === 'approved' ? (
                <div className="rounded border border-[#C7DDD1] bg-[#EAF2EE] p-3 text-xs text-[#1E4334]">
                  <p className="font-bold">✓ Milestone Approved in Demo State</p>
                  <p className="mt-1 text-[11px]">
                    Recorded by {selectedMilestone.submissionDetails.reviewDecision.decidedBy} on{' '}
                    {new Date(
                      selectedMilestone.submissionDetails.reviewDecision.decidedAt || '',
                    ).toLocaleDateString()}
                    . Audit ref: {selectedMilestone.submissionDetails.reviewDecision.auditRef} (Notice: No real PayPal capture executed).
                  </p>
                </div>
              ) : selectedMilestone.submissionDetails?.reviewDecision?.status === 'revision_requested' ? (
                <div className="rounded border border-[#F1D6B3] bg-[#FEF9F2] p-3 text-xs text-[#915416]">
                  <p className="font-bold">⏳ Revision Request Recorded (Demo)</p>
                  <p className="mt-1 text-[11px]">
                    Feedback: {selectedMilestone.submissionDetails.reviewDecision.feedback}
                  </p>
                </div>
              ) : selectedMilestone.submissionDetails?.reviewDecision?.status === 'escalated' ? (
                <div className="rounded border border-[#F5C2C2] bg-[#FDE8E8] p-3 text-xs text-[#9B2C2C]">
                  <p className="font-bold">⚠️ Escalation Recorded (Demo)</p>
                  <p className="mt-1 text-[11px]">
                    Arbitration simulated in local demo state.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-ink-600 leading-relaxed">
                  As the client authority in this demonstration, you can simulate approving deliverable verification, requesting revision against unmet criteria, or escalating for mediation. This is an interactive UI simulation that updates local demo state only.
                </p>
              )}

              {/* Action Buttons (Clearly labeled demo triggers) */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => setModalType('approve')}
                  className="rounded-md bg-[#1E4334] px-4 py-2 text-xs font-semibold text-white hover:bg-[#153126] transition-colors shadow-2xs"
                >
                  Approve Deliverable (Demo)
                </button>

                <button
                  onClick={() => setModalType('request_revision')}
                  className="rounded-md border border-border-default bg-surface px-3.5 py-2 text-xs font-semibold text-ink-700 hover:bg-canvas-subtle transition-colors"
                >
                  Request Revision (Demo)
                </button>

                <button
                  onClick={() => setModalType('escalate')}
                  className="rounded-md border border-border-default bg-surface px-3 py-2 text-xs font-medium text-ink-600 hover:bg-canvas-subtle transition-colors flex items-center gap-1.5"
                >
                  <Scale className="h-3.5 w-3.5 text-ink-500" />
                  <span>Escalate to Human Review (Demo)</span>
                </button>
              </div>

              <div className="pt-2 text-[10px] text-ink-400">
                Prototype Safety Notice: All decision buttons only update local component state. They do not trigger monetary movement, PayPal captures, refunds, or external communications.
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Coherent Payment History & Transaction Ledger ───────────── */}
      <section className="rounded-xl border border-border-default bg-surface p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div>
            <h3 className="font-editorial text-lg font-bold text-ink-900">
              Contract Allocation & Sample Transaction Ledger
            </h3>
            <p className="text-xs text-ink-500">
              Demonstration record of simulated payment state transitions (separate from allocation totals above)
            </p>
          </div>
          <span className="text-xs font-medium text-ink-500">
            {samplePayments.filter((p) => p.projectName === project.name).length} sample record(s)
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-ink-700">
            <thead>
              <tr className="border-b border-border-default text-ink-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 font-semibold">Sample Ref</th>
                <th className="py-2.5 font-semibold">Milestone</th>
                <th className="py-2.5 font-semibold">Settlement Status (Sample)</th>
                <th className="py-2.5 font-semibold">Amount</th>
                <th className="py-2.5 font-semibold">Sample PayPal Order ID</th>
                <th className="py-2.5 font-semibold">Recorded Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {samplePayments
                .filter((p) => p.projectName === project.name)
                .map((tx) => (
                  <tr key={tx.id} className="hover:bg-canvas-subtle/50">
                    <td className="py-3 font-mono font-medium text-ink-900">{tx.referenceId}</td>
                    <td className="py-3 font-medium text-ink-900">{tx.milestoneTitle}</td>
                    <td className="py-3">
                      <StatusBadge label="Captured in demo data" variant="forest" />
                    </td>
                    <td className="py-3 font-editorial font-bold text-ink-900">
                      ${tx.amount.toLocaleString()} USD
                    </td>
                    <td className="py-3 font-mono text-[11px] text-ink-500">{tx.paypalOrderId}</td>
                    <td className="py-3 text-ink-500">{new Date(tx.timestamp).toLocaleDateString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Prototype notice banner */}
        <div className="mt-4 rounded border border-border-subtle bg-canvas-subtle p-3 text-center text-xs text-ink-500">
          <ShieldCheck className="inline-block h-3.5 w-3.5 mr-1 text-[#244637]" />
          <strong>Prototype Notice:</strong> MilestoneShield AI is an AI-assisted milestone payment prototype, not a bank or regulated escrow service. In production, milestone funding is authorized via PayPal Sandbox (authorization intent without immediate capture) and captured only upon explicit client sign-off verified by the backend policy engine. The transactions above are sample demonstration data.
        </div>
      </section>

      {/* Review Action Modal */}
      <ReviewActionModal
        type={modalType}
        milestone={selectedMilestone}
        onClose={() => setModalType(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
