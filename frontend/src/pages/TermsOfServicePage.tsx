import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, AlertCircle } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1A2E26] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Navigation header */}
        <div className="flex items-center justify-between pb-8 mb-8 border-b border-[#E5E0D8]">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#1E4334] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Workspace
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#1E4334]" />
            <span className="font-serif text-sm font-bold text-[#1A2E26]">MilestoneShield AI</span>
          </div>
        </div>

        {/* Legal Review Warning Badge */}
        <div className="mb-8 p-4 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] flex items-start gap-3 text-xs text-[#92400E]">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#D97706]" />
          <div>
            <strong className="block font-semibold mb-1">PRE-LAUNCH DRAFT — NOT FINAL LEGAL ADVICE</strong>
            <p className="leading-relaxed">
              These terms are a working draft for the MilestoneShield AI hackathon prototype.
              Placeholders for governing law, dispute arbitration, and operating entity are indicated in brackets.
              Subject to qualified legal counsel review before public commercial availability.
            </p>
          </div>
        </div>

        <article className="prose prose-sm max-w-none text-[#1A2E26] space-y-6">
          <header className="border-b border-[#E5E0D8] pb-6">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#1A2E26] mb-2">
              Terms of Service
            </h1>
            <p className="text-xs text-[#7D8F85]">
              Last updated: October 2026 • Version 0.1.0-draft
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">1. Nature of the Service & Non-Escrow Status</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              MilestoneShield AI (&ldquo;the Platform&rdquo;) is a software workflow tool designed to coordinate milestone definitions, acceptance criteria verification, and payment gateway authorizations between independent clients and freelancers.
            </p>
            <div className="p-3.5 rounded-lg bg-[#F5F2EB] border border-[#E5E0D8] text-xs text-[#1A2E26]">
              <strong>MANDATORY NOTICE:</strong> MilestoneShield AI is NOT a bank, trust institution, or regulated escrow service provider. We do not accept, hold, or transmit funds. Payment authorization holds and captures are executed exclusively by licensed third-party payment gateways (e.g. PayPal Sandbox in this testing phase).
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">2. User Roles and Account Responsibilities</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              Users register as either a <strong>Client</strong> or a <strong>Freelancer</strong>:
            </p>
            <ul className="list-disc pl-5 text-xs text-[#4A5D53] space-y-1.5">
              <li><strong>Clients:</strong> Agree to provide measurable, objective milestone acceptance criteria before work begins. Clients are solely responsible for creating payment authorization holds through their own PayPal accounts and confirming milestone captures upon satisfactory completion.</li>
              <li><strong>Freelancers:</strong> Agree to submit verifiable proof deliverables corresponding directly to the agreed acceptance criteria. Freelancers understand that payment release requires client approval or formal dispute resolution.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">3. Payment Flow Rules: Authorization and Capture</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              To protect both parties, milestone financial transactions follow strict state rules:
            </p>
            <ul className="list-disc pl-5 text-xs text-[#4A5D53] space-y-1.5">
              <li><strong>Authorization Hold (Intent = AUTHORIZE):</strong> Funding a milestone authorizes an order on the payment gateway, placing a temporary hold on the client&apos;s source account. Funds are NOT immediately transferred.</li>
              <li><strong>Human Capture Release:</strong> Authorized funds are captured and settled ONLY upon explicit affirmative confirmation from the client or authorized platform operator.</li>
              <li><strong>Strict Prohibition on Automated AI Payouts:</strong> AI models, verification engines, or automated confidence scores can NEVER directly trigger payment capture or fund disbursement. Human operator confirmation is mandatory.</li>
              <li><strong>Voiding Holds:</strong> If a milestone agreement is cancelled by mutual consent before capture, the authorization hold is voided and released back to the client.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">4. Sandbox Environment Limitations</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              During the current Hackathon and evaluation phase, the platform operates strictly against the <strong>PayPal Sandbox</strong> test environment (<code>api-m.sandbox.paypal.com</code>). No real monetary transfers, currency conversions, or legal liabilities are incurred during Sandbox operations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">5. Governing Law and Dispute Arbitration</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              These terms shall be governed by and construed under the laws of <code>[GOVERNING JURISDICTION: e.g. State of Delaware, USA]</code> without regard to conflict of law principles. Any dispute arising from these terms shall be resolved by binding arbitration administered by <code>[ARBITRATION TRIBUNAL / FORUM]</code>.
            </p>
          </section>
        </article>

        <footer className="mt-12 pt-6 border-t border-[#E5E0D8] text-center text-xs text-[#7D8F85]">
          &copy; 2026 MilestoneShield AI. Prototype for PayPal AI Hackathon 2026.
        </footer>
      </div>
    </div>
  );
}
