import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck2,
  Inbox,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import StatusBadge, { submissionVariant } from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { sampleSubmissions } from '../data/sampleData';

export default function SubmissionsPage() {
  const [filter, setFilter] = useState<'all' | 'pending_review' | 'approved'>('all');

  const filteredSubmissions = sampleSubmissions.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  if (sampleSubmissions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border-default pb-5">
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
            Reviews & Deliverable Submissions
          </h1>
        </div>
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="No submissions yet"
          description="Submissions will appear here once freelancers upload deliverables for milestone acceptance review."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border-default pb-5">
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
          Reviews & Deliverable Submissions
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Evaluate submitted work artifacts against contractual acceptance criteria in this demonstration feed.
          <span className="ml-1 text-ink-400">(Sample demonstration data)</span>
        </p>
      </div>

      {/* AI Transparency Notice Banner */}
      <div className="rounded-lg border border-[#F1D6B3] bg-[#FEF9F2] p-3 text-xs text-[#8A4F12]">
        <strong>⚠️ AI Transparency Notice:</strong> All acceptance analyses and confidence scores displayed below are pre-computed mock data for prototype demonstration. No live Anthropic API was called. Live Claude model integration is scheduled for Milestone 2.
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All Submissions' },
          { id: 'pending_review', label: 'Pending Client Review' },
          { id: 'approved', label: 'Approved & Released' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id as typeof filter)}
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

      {/* Submissions Cards */}
      <div className="space-y-4">
        {filteredSubmissions.map((sub) => (
          <div
            key={sub.id}
            className="rounded-xl border border-border-default bg-surface p-6 shadow-xs space-y-4 transition-all hover:border-border-strong"
          >
            {/* Top row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-border-subtle pb-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md border border-border-subtle bg-canvas-subtle p-2 text-ink-700">
                  <FileCheck2 className="h-5 w-5 text-[#244637]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-ink-400">SUB-{sub.id} (Sample)</span>
                    <span>·</span>
                    <span className="text-xs text-ink-500 font-medium">{sub.projectName}</span>
                  </div>
                  <h3 className="font-editorial text-lg font-bold text-ink-900">
                    {sub.milestoneTitle}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start">
                <StatusBadge
                  label={sub.status.replace(/_/g, ' ')}
                  variant={submissionVariant(sub.status)}
                  size="md"
                />
              </div>
            </div>

            {/* Submitter summary */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">
                Deliverable Narrative
              </p>
              <p className="text-xs text-ink-700 leading-relaxed bg-canvas-subtle/50 rounded-lg p-3 border border-border-subtle">
                {sub.summary}
              </p>
            </div>

            {/* Criteria checks summary */}
            {sub.criteriaChecks && sub.criteriaChecks.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
                  Criterion-by-Criterion Acceptance Checks (Sample)
                </p>
                <div className="space-y-2">
                  {sub.criteriaChecks.map((chk) => (
                    <div
                      key={chk.id}
                      className="flex items-start justify-between gap-3 rounded border border-border-subtle bg-surface p-2.5 text-xs text-ink-700"
                    >
                      <div className="flex items-start gap-2">
                        {chk.status === 'met' ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#244637]" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#CD7B22]" />
                        )}
                        <span>{chk.criterion}</span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                          chk.status === 'met'
                            ? 'bg-[#EAF2EE] text-[#1E4334]'
                            : 'bg-[#FDF3E5] text-[#915416]'
                        }`}
                      >
                        {chk.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI verification badge & Artifacts */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {sub.aiConfidence !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded border border-[#F1D6B3] bg-[#FEF9F2] px-2.5 py-1 text-xs font-semibold text-[#915416]">
                    <Sparkles className="h-3.5 w-3.5 text-[#915416]" />
                    <span>SIMULATED AI REVIEW — DEMO DATA (Score: {(sub.aiConfidence * 100).toFixed(0)}%)</span>
                  </span>
                )}
                <span className="text-[11px] text-ink-500">
                  Submitted by {sub.submittedBy} · {new Date(sub.submittedAt).toLocaleDateString()}
                </span>
              </div>

              {/* Sample Artifacts badges (demonstrative, not fake broken links) */}
              {sub.assets && (
                <div className="flex flex-wrap items-center gap-2">
                  {sub.assets.map((asset, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-700 border border-border-default rounded px-2 py-0.5 bg-canvas-subtle"
                    >
                      <FileText className="h-3 w-3 text-ink-500" />
                      <span className="truncate max-w-[140px]">{asset.name}</span>
                      <span className="text-[9px] rounded bg-surface px-1 text-ink-400 border border-border-subtle">
                        Sample
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer action link to Contract Workspace */}
            <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-xs">
              <span className="text-[11px] text-ink-400">
                Decision authority: Client Organization (Prototype Demo)
              </span>

              <Link
                to="/"
                className="inline-flex items-center gap-1.5 font-semibold text-[#1E4334] hover:underline"
              >
                <span>Open in Contract Workspace</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
