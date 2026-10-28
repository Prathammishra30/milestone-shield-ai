import { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, HelpCircle, ShieldCheck } from 'lucide-react';
import type { Milestone } from '../types';

export type ModalType = 'approve' | 'request_revision' | 'escalate' | 'message';

interface ReviewActionModalProps {
  type: ModalType | null;
  milestone: Milestone;
  onClose: () => void;
  onConfirm: (action: 'approved' | 'revision_requested' | 'escalated', note: string) => void;
}

export default function ReviewActionModal({
  type,
  milestone,
  onClose,
  onConfirm,
}: ReviewActionModalProps) {
  const [feedback, setFeedback] = useState(
    milestone.submissionDetails?.aiVerification?.missingRequirements[0]
      ? `Please address test coverage: ${milestone.submissionDetails.aiVerification.missingRequirements[0]}`
      : 'Please revise according to milestone acceptance criteria.',
  );
  const [escalationReason, setEscalationReason] = useState('criteria_dispute');
  const [messageText, setMessageText] = useState('');
  const [sentMessage, setSentMessage] = useState(false);

  if (!type) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0C1A14]/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl border border-border-default bg-surface p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            {type === 'approve' && (
              <div className="rounded-full bg-[#EAF2EE] p-2 text-[#1E4334]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            )}
            {type === 'request_revision' && (
              <div className="rounded-full bg-[#FDF3E5] p-2 text-[#915416]">
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}
            {type === 'escalate' && (
              <div className="rounded-full bg-[#FDE8E8] p-2 text-[#9B2C2C]">
                <HelpCircle className="h-5 w-5" />
              </div>
            )}
            {type === 'message' && (
              <div className="rounded-full bg-[#ECF2F6] p-2 text-[#2C4A5C]">
                <ShieldCheck className="h-5 w-5" />
              </div>
            )}
            <div>
              <h3 className="font-editorial text-lg font-bold text-ink-900">
                {type === 'approve' && 'Approve Milestone Deliverable (Demo Only)'}
                {type === 'request_revision' && 'Request Deliverable Revision (Demo Only)'}
                {type === 'escalate' && 'Escalate to Human Review (Demo Only)'}
                {type === 'message' && 'Contract Communication Simulation (Demo Only)'}
              </h3>
              <p className="text-xs text-ink-500">
                Milestone: {milestone.title} (${milestone.amount.toLocaleString()} USD — Demo Allocation)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-canvas-subtle hover:text-ink-700"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content based on type */}
        <div className="py-4 text-sm">
          {type === 'approve' && (
            <div className="space-y-4">
              <p className="text-ink-700 leading-relaxed text-xs">
                You are testing the approval action for <strong>{milestone.title}</strong> in the demo workspace.
              </p>

              <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-3.5 space-y-2 text-xs text-ink-600">
                <div className="flex justify-between">
                  <span className="font-medium text-ink-700">Milestone Amount:</span>
                  <span className="font-bold text-ink-900">${milestone.amount.toLocaleString()} USD (Sample)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-ink-700">Planned Routing:</span>
                  <span>PayPal Sandbox REST API (Policy Engine Gated)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-ink-700">Sample Audit Ref:</span>
                  <span className="font-mono text-[11px]">SAMPLE-AUDIT-LOG-102</span>
                </div>
              </div>

              {/* Explicit Safety & Disclaimer Box */}
              <div className="rounded border border-[#F1D6B3] bg-[#FEF9F2] p-3 text-xs text-[#8A4F12] space-y-1.5">
                <p className="font-semibold">⚠️ Safety & Prototype Notice:</p>
                <p className="leading-relaxed">
                  This confirmation <strong>only updates local demo component state</strong>. It does <strong>NOT</strong> move real money, capture PayPal authorizations, execute bank transfers, or communicate with external payment services. MilestoneShield AI is an AI-assisted prototype and not a regulated escrow service.
                </p>
              </div>
            </div>
          )}

          {type === 'request_revision' && (
            <div className="space-y-3">
              <p className="text-ink-700 leading-relaxed text-xs">
                Specify criteria deficiencies or feedback for the freelancer. PayPal authorization remains uncaptured while revisions are prepared in demo state.
              </p>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Required Revisions & Feedback
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-border-default bg-surface p-2.5 text-xs text-ink-900 focus:border-[#244637] focus:outline-hidden"
                  placeholder="Detail unmet acceptance criteria..."
                />
              </div>

              <div className="rounded border border-[#F1D6B3] bg-[#FEF9F2] p-2.5 text-xs text-[#8A4F12]">
                <strong>⚠️ Demo Notice:</strong> This action only records revision feedback in local component state. It does NOT send external emails, SMS, or dispatch live notifications.
              </div>
            </div>
          )}

          {type === 'escalate' && (
            <div className="space-y-3">
              <p className="text-ink-700 leading-relaxed text-xs">
                Escalation simulates pausing automated milestone release and flagging the contract for human mediation review.
              </p>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Primary Escalation Reason
                </label>
                <select
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  className="w-full rounded border border-border-default bg-surface p-2 text-xs text-ink-900 focus:border-[#244637] focus:outline-hidden"
                >
                  <option value="criteria_dispute">Ambiguity in Acceptance Criteria Interpretation</option>
                  <option value="scope_expansion">Unagreed Scope Expansion / Deviation</option>
                  <option value="test_delta">Technical Metric or Coverage Dispute</option>
                  <option value="unresponsive">Unresponsive Counterparty</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Detailed Explanation for Arbitrator
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded border border-border-default bg-surface p-2.5 text-xs text-ink-900 focus:border-[#244637] focus:outline-hidden"
                  placeholder="Describe context for human review..."
                  defaultValue="Requesting human review on criterion 3 interpretation regarding acceptable test coverage tolerances."
                />
              </div>

              <div className="rounded border border-[#F1D6B3] bg-[#FEF9F2] p-2.5 text-xs text-[#8A4F12]">
                <strong>⚠️ Demo Notice:</strong> Escalation in this prototype updates local UI status only. It does NOT file legal arbitration, contact external mediators, or trigger banking holds.
              </div>
            </div>
          )}

          {type === 'message' && (
            <div className="space-y-3">
              {sentMessage ? (
                <div className="rounded border border-[#C7DDD1] bg-[#EAF2EE] p-4 text-center">
                  <p className="text-sm font-semibold text-[#1E4334]">Message Simulated (Local Demo Only)</p>
                  <p className="text-xs text-[#2E5846] mt-1">
                    Your message was logged to the local demonstration session. No external email or notification was sent.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-ink-700 leading-relaxed text-xs">
                    Demonstration of direct contract correspondence. In production, messages are cryptographically logged in the audit trail.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-ink-700 mb-1">
                      Message Content (Simulation)
                    </label>
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows={3}
                      className="w-full rounded border border-border-default bg-surface p-2.5 text-xs text-ink-900 focus:border-[#244637] focus:outline-hidden"
                      placeholder="Type your message to Jane Dev & Studio / Acme Retail Corp..."
                      defaultValue="Hi Jane, I noticed the test coverage report is at 78.4%. Could you add tests for CheckoutForm so we can complete Milestone 2?"
                    />
                  </div>

                  <div className="rounded border border-[#F1D6B3] bg-[#FEF9F2] p-2.5 text-xs text-[#8A4F12]">
                    <strong>⚠️ Demo Notice:</strong> This messaging tool is a user interface demonstration. It does NOT dispatch real emails, SMS, or external notifications.
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
          <button
            onClick={onClose}
            className="rounded border border-border-default bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-canvas-subtle"
          >
            {type === 'message' && sentMessage ? 'Close' : 'Cancel'}
          </button>

          {type === 'approve' && (
            <button
              onClick={() => onConfirm('approved', 'Client approved milestone deliverable in demo state.')}
              className="rounded bg-[#1E4334] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#153126]"
            >
              Update Local Demo State to Approved
            </button>
          )}

          {type === 'request_revision' && (
            <button
              onClick={() => onConfirm('revision_requested', feedback)}
              className="rounded bg-[#915416] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#724110]"
            >
              Record Revision Request (Local Demo)
            </button>
          )}

          {type === 'escalate' && (
            <button
              onClick={() => onConfirm('escalated', `Escalated: ${escalationReason}`)}
              className="rounded bg-[#9B2C2C] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#782323]"
            >
              Record Escalation (Local Demo)
            </button>
          )}

          {type === 'message' && !sentMessage && (
            <button
              onClick={() => setSentMessage(true)}
              className="rounded bg-[#1E4334] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#153126]"
            >
              Simulate Send (Local Demo)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
