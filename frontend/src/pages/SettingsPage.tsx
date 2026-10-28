import { ShieldCheck, KeyRound, Users, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border-default pb-5">
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
          Platform Rules & Governance Settings
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Cryptographic security boundaries, PayPal Sandbox configuration, and policy engine constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Policy Engine Rules */}
        <section className="rounded-xl border border-border-default bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <ShieldCheck className="h-5 w-5 text-[#1E4334]" />
            <h2 className="font-editorial text-lg font-bold text-ink-900">
              Payment Policy Engine Constraints
            </h2>
          </div>

          <p className="text-xs text-ink-600 leading-relaxed">
            The MilestoneShield AI backend policy engine strictly governs all fund movements under immutable guardrails:
          </p>

          <ul className="space-y-3 text-xs text-ink-700">
            <li className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-canvas-subtle p-3">
              <span className="mt-0.5 h-2 w-2 rounded-full bg-[#1E4334] shrink-0" />
              <div>
                <strong className="text-ink-900">Zero Autonomous AI Execution:</strong>
                <p className="mt-0.5 text-ink-600">The AI model acts solely as an analytical verifier. It can never independently trigger payment capture, release, or refund.</p>
              </div>
            </li>

            <li className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-canvas-subtle p-3">
              <span className="mt-0.5 h-2 w-2 rounded-full bg-[#1E4334] shrink-0" />
              <div>
                <strong className="text-ink-900">Authorization Intent Mandatory (Not Escrow):</strong>
                <p className="mt-0.5 text-ink-600">All PayPal orders are created with <code className="font-mono text-[11px] bg-surface px-1 py-0.5 rounded">INTENT=AUTHORIZE</code> (not immediate capture). Funds are not held in an escrow account; PayPal places a temporary authorization hold on the client's payment method until acceptance criteria are verified.</p>
              </div>
            </li>

            <li className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-canvas-subtle p-3">
              <span className="mt-0.5 h-2 w-2 rounded-full bg-[#CD7B22] shrink-0" />
              <div>
                <strong className="text-ink-900">Mandatory Human Arbitration on Ambiguity:</strong>
                <p className="mt-0.5 text-ink-600">Any criteria ambiguity, delta shortfall, or disputed deliverable escalates automatically to human mediation, freezing release timers.</p>
              </div>
            </li>

            <li className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-canvas-subtle p-3">
              <span className="mt-0.5 h-2 w-2 rounded-full bg-[#1E4334] shrink-0" />
              <div>
                <strong className="text-ink-900">Cryptographic Audit Trail:</strong>
                <p className="mt-0.5 text-ink-600">Every state transition (submission, AI evaluation, client review, release) is immutably recorded with sha256 checksums.</p>
              </div>
            </li>
          </ul>
        </section>

        {/* Integration Status & Credentials */}
        <section className="rounded-xl border border-border-default bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <KeyRound className="h-5 w-5 text-ink-700" />
            <h2 className="font-editorial text-lg font-bold text-ink-900">
              Gateway & Model Configuration
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-800">PayPal REST API</span>
                <span className="rounded bg-[#FDF3E5] px-2 py-0.5 text-[10px] font-bold text-[#915416] border border-[#F1D6B3]">
                  SANDBOX MODE (SIMULATION)
                </span>
              </div>
              <p className="text-ink-600">Base URL: <code className="font-mono text-[11px]">https://api-m.sandbox.paypal.com</code></p>
              <p className="text-ink-500 text-[11px]">Milestone 1 uses placeholder transactions. Live Sandbox API v2 connects in Milestone 2.</p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-800">Anthropic Claude API</span>
                <span className="rounded bg-[#FDF3E5] px-2 py-0.5 text-[10px] font-bold text-[#915416] border border-[#F1D6B3]">
                  SIMULATED IN M1 · PLANNED M2
                </span>
              </div>
              <p className="text-ink-600">Model: <code className="font-mono text-[11px]">claude-3-5-sonnet-20241022 (Planned)</code></p>
              <p className="text-ink-500 text-[11px]">Currently in Milestone 1, all AI review outputs are simulated demo data. Live Anthropic Claude API will be connected in Milestone 2.</p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-800">PostgreSQL Database</span>
                <span className="rounded bg-[#F4EFE6] px-2 py-0.5 text-[10px] font-bold text-ink-600 border border-[#DFD8CC]">
                  PLANNED M2
                </span>
              </div>
              <p className="text-ink-600">Persistence Layer: Relational tables for contracts, milestones, criteria, and audit logs.</p>
            </div>
          </div>
        </section>

        {/* Hackathon Team Division */}
        <section className="rounded-xl border border-border-default bg-surface p-6 shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <Users className="h-5 w-5 text-ink-700" />
            <h2 className="font-editorial text-lg font-bold text-ink-900">
              PayPal AI Hackathon 2026 — Team Ownership
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-4 space-y-1.5">
              <span className="font-mono text-[10px] font-bold text-[#1E4334] uppercase tracking-wider">
                Person 1
              </span>
              <p className="font-semibold text-sm text-ink-900">PayPal Integration & Backend</p>
              <p className="text-ink-600 leading-relaxed text-xs">
                Express API, PayPal Sandbox order creation, authorize & capture flows, policy engine rules, and audit logging.
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-4 space-y-1.5">
              <span className="font-mono text-[10px] font-bold text-[#CD7B22] uppercase tracking-wider">
                Person 2
              </span>
              <p className="font-semibold text-sm text-ink-900">AI Milestone & Verification Engine</p>
              <p className="text-ink-600 leading-relaxed text-xs">
                Anthropic Claude prompt pipelines for milestone breakdown generation and deliverable criterion verification.
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-4 space-y-1.5">
              <span className="font-mono text-[10px] font-bold text-[#2C4A5C] uppercase tracking-wider">
                Person 3
              </span>
              <p className="font-semibold text-sm text-ink-900">Frontend, UX & Deployment</p>
              <p className="text-ink-600 leading-relaxed text-xs">
                React 19 + TypeScript editorial fintech workspace, AG Grid ledger, Render deployment, and submission materials.
              </p>
            </div>
          </div>

          <div className="rounded border border-[#F1D6B3] bg-[#FEF9F2] p-3 text-xs text-[#8A4F12] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#CD7B22]" />
            <span>
              <strong>Legal Disclaimer:</strong> MilestoneShield AI is an AI-assisted milestone payment workflow prototype, not a legally chartered banking institution or regulated escrow service.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
