import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, AlertCircle } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            <strong className="block font-semibold mb-1">DRAFT FOR QUALIFIED LEGAL REVIEW</strong>
            <p className="leading-relaxed">
              This document is a pre-production draft template prepared for the MilestoneShield AI hackathon prototype.
              It contains explicit bracketed placeholders for operator entity, legal jurisdiction, and data processors.
              This document must be reviewed by qualified legal counsel prior to commercial production launch.
            </p>
          </div>
        </div>

        <article className="prose prose-sm max-w-none text-[#1A2E26] space-y-6">
          <header className="border-b border-[#E5E0D8] pb-6">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#1A2E26] mb-2">
              Privacy Policy
            </h1>
            <p className="text-xs text-[#7D8F85]">
              Last updated: October 2026 • Version 0.1.0-draft
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">1. Data Controller and Entity Information</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              This application is operated by <code>[LEGAL ENTITY NAME: Pending Formal Registration]</code>, with registered offices at <code>[LEGAL ENTITY ADDRESS / JURISDICTION]</code> (&ldquo;MilestoneShield&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). For inquiries regarding data protection and personal data processing, contact <code>[DESIGNATED PRIVACY OFFICER EMAIL: privacy@example.com]</code>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">2. Information We Collect</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              We collect only the minimum personal data strictly necessary to authenticate users, facilitate milestone tracking, and interface with authorized payment sandbox services:
            </p>
            <ul className="list-disc pl-5 text-xs text-[#4A5D53] space-y-1.5">
              <li><strong>Account Credentials:</strong> Full name, verified work email address, encrypted authentication tokens managed via Supabase Auth. Passwords are never stored or visible in plain text.</li>
              <li><strong>Contract & Milestone Specifications:</strong> Contract titles, milestone descriptions, objective acceptance criteria, and project budget figures.</li>
              <li><strong>Deliverable Submissions:</strong> URLs and links to written or coded deliverables submitted for milestone verification.</li>
              <li><strong>Payment Gateway References:</strong> PayPal Sandbox Order IDs, Authorization IDs, Capture IDs, and transaction timestamps. We do not store buyer credit card numbers, CVVs, or bank account credentials.</li>
              <li><strong>Technical & Security Metadata:</strong> IP address (evaluated for rate limiting and proxy integrity), browser user agent, and tamper-evident audit logs.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">3. Third-Party Service Processors</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              Data is processed by the following verified external infrastructure providers under standard data protection agreements:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-[#E5E0D8] rounded-lg">
                <thead className="bg-[#F5F2EB] text-[#1A2E26]">
                  <tr>
                    <th className="p-2.5 border-b border-[#E5E0D8]">Processor</th>
                    <th className="p-2.5 border-b border-[#E5E0D8]">Purpose</th>
                    <th className="p-2.5 border-b border-[#E5E0D8]">Data Processed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D8] text-[#4A5D53]">
                  <tr>
                    <td className="p-2.5 font-medium text-[#1A2E26]">Supabase Inc.</td>
                    <td className="p-2.5">User Authentication & PostgreSQL Database</td>
                    <td className="p-2.5">Email, Name, User IDs, Contract Schemas</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#1A2E26]">PayPal Inc.</td>
                    <td className="p-2.5">Sandbox Milestone Payment Authorization & Capture</td>
                    <td className="p-2.5">Order IDs, Authorization IDs, Sandbox Buyer Accounts</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#1A2E26]">PostHog / Analytics Provider</td>
                    <td className="p-2.5">Product Usage Analytics (Consent-Gated)</td>
                    <td className="p-2.5">Page views, feature adoption (All PII & credentials strictly scrubbed)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium text-[#1A2E26]">Sentry / Monitoring Provider</td>
                    <td className="p-2.5">Application Error Diagnostics</td>
                    <td className="p-2.5">Crash stack traces (Sanitized: auth headers & tokens omitted)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">4. Analytics and Error Monitoring Controls</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              Our analytics abstraction strictly scrubs deliverable text, passwords, session tokens, and financial identifiers prior to recording. We respect browser <code>Do Not Track</code> signals. You may also opt out of product analytics at any time via Account Settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">5. Account Deletion and Retention Policy</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              Users may request immediate account closure via <strong>Account Settings &rarr; Delete Account</strong>. When an account is closed:
            </p>
            <ul className="list-disc pl-5 text-xs text-[#4A5D53] space-y-1.5">
              <li><strong>Personal Profile Data:</strong> Full name, email address, avatar, and contact profiles are permanently deleted and anonymized (e.g. <code>anonymized-usr-xxx@deleted.milestoneshield.internal</code>).</li>
              <li><strong>Financial & Audit Records:</strong> Under statutory accounting and tax retention requirements (e.g. <code>[SPECIFY APPLICABLE STATUTORY PERIOD: 5 to 7 years depending on jurisdiction]</code>), completed transaction records, PayPal authorization references, and audit logs are retained in an immutable, anonymized format to preserve dispute and reconciliation integrity. They are not blindly cascade-deleted.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#1A2E26]">6. Non-Escrow Regulatory Disclaimer</h2>
            <p className="text-xs text-[#4A5D53] leading-relaxed">
              MilestoneShield AI is a software workflow tool. We do not hold client funds on deposit, operate escrow trust accounts, or act as a regulated banking institution. All payment authorizations and captures are executed directly via external payment processors (e.g. PayPal Sandbox).
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
