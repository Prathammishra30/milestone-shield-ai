import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';
import {
  Shield,
  Briefcase,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  CreditCard,
  FileCheck2,
  Info,
} from 'lucide-react';

export default function OnboardingPage() {
  const { user, profile, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole>(profile?.role || 'client');
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [workspaceName, setWorkspaceName] = useState(
    selectedRole === 'client' ? 'Acme E-Commerce Redesign' : 'Design & Full-Stack Studio'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async () => {
    if (step === 1) {
      if (!fullName.trim()) {
        setError('Please enter your full name to proceed.');
        return;
      }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      if (!workspaceName.trim()) {
        setError('Please enter a name for your initial workspace or project.');
        return;
      }
      setError(null);
      setStep(3);
    } else if (step === 3) {
      setIsSubmitting(true);
      setError(null);
      try {
        await completeOnboarding(selectedRole, fullName);
        navigate('/', { replace: true });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to complete onboarding.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-[#1A2E26]">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1E4334] flex items-center justify-center text-[#E5F3EB] shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight text-[#1A2E26]">
              MilestoneShield
            </span>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className={`h-1.5 w-16 rounded-full transition-colors ${step >= 1 ? 'bg-[#1E4334]' : 'bg-[#E5E0D8]'}`} />
          <span className={`h-1.5 w-16 rounded-full transition-colors ${step >= 2 ? 'bg-[#1E4334]' : 'bg-[#E5E0D8]'}`} />
          <span className={`h-1.5 w-16 rounded-full transition-colors ${step >= 3 ? 'bg-[#1E4334]' : 'bg-[#E5E0D8]'}`} />
        </div>

        <div className="bg-white py-10 px-6 sm:px-10 shadow-sm border border-[#E5E0D8] rounded-2xl">
          {error && (
            <div className="mb-6 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#991B1B]">
              {error}
            </div>
          )}

          {/* STEP 1: Role and Identity Confirmation */}
          {step === 1 && (
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#1E4334] block mb-1">
                Step 1 of 3 — Profile & Primary Role
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1A2E26] mb-2">
                How will you use MilestoneShield?
              </h1>
              <p className="text-xs text-[#4A5D53] leading-relaxed mb-6">
                Your role determines which permissions and actions you can perform. Select how you will collaborate on milestone agreements.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label htmlFor="onboarding-name" className="block text-xs font-medium text-[#1A2E26] mb-1">
                    Your Full Name
                  </label>
                  <input
                    id="onboarding-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Vance"
                    className="block w-full px-3 py-2 text-xs border border-[#D5CEC2] rounded-lg bg-[#FDFCFB] focus:outline-none focus:ring-2 focus:ring-[#1E4334]"
                  />
                  <p className="mt-1 text-[11px] text-[#7D8F85]">
                    Signed in as {user?.email}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  <div
                    onClick={() => setSelectedRole('client')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedRole === 'client'
                        ? 'border-[#1E4334] bg-[#E5F3EB]/40 ring-2 ring-[#1E4334]'
                        : 'border-[#D5CEC2] hover:bg-[#F5F2EB]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#E5F3EB] text-[#1E4334] flex items-center justify-center mb-3">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-[#1A2E26] mb-1">Client / Project Owner</h2>
                    <p className="text-xs text-[#4A5D53] leading-relaxed">
                      Define milestone acceptance criteria, authorize payments via PayPal Sandbox, and release payouts once deliverables are approved.
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedRole('freelancer')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedRole === 'freelancer'
                        ? 'border-[#1E4334] bg-[#E5F3EB]/40 ring-2 ring-[#1E4334]'
                        : 'border-[#D5CEC2] hover:bg-[#F5F2EB]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#E5F3EB] text-[#1E4334] flex items-center justify-center mb-3">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-[#1A2E26] mb-1">Freelancer / Builder</h2>
                    <p className="text-xs text-[#4A5D53] leading-relaxed">
                      Submit deliverable proof, inspect objective criteria compliance, and get paid with transparent authorization protection.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Workspace & Contract Setup */}
          {step === 2 && (
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#1E4334] block mb-1">
                Step 2 of 3 — Workspace Configuration
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1A2E26] mb-2">
                Name your initial workspace
              </h1>
              <p className="text-xs text-[#4A5D53] leading-relaxed mb-6">
                Workspaces isolate contracts, deliverables, and financial milestone records for each client-freelancer engagement.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label htmlFor="workspace-name" className="block text-xs font-medium text-[#1A2E26] mb-1">
                    Workspace / Project Title
                  </label>
                  <input
                    id="workspace-name"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g. E-Commerce Storefront Redesign"
                    className="block w-full px-3 py-2 text-xs border border-[#D5CEC2] rounded-lg bg-[#FDFCFB] focus:outline-none focus:ring-2 focus:ring-[#1E4334]"
                  />
                </div>

                <div className="p-4 rounded-xl bg-[#F5F2EB] border border-[#E5E0D8] space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1A2E26]">
                    <Shield className="w-4 h-4 text-[#1E4334]" />
                    <span>Multi-User Tenant Security</span>
                  </div>
                  <p className="text-xs text-[#4A5D53] leading-relaxed">
                    All milestone payment orders, authorizations, and deliverable submissions inside this workspace will be cryptographically isolated. Only verified members with matching contract access can view or mutate records.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Educational Walkthrough & Transparency */}
          {step === 3 && (
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#1E4334] block mb-1">
                Step 3 of 3 — Workflow & Transparency Rules
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#1A2E26] mb-2">
                Proof before payout. How it works:
              </h1>
              <p className="text-xs text-[#4A5D53] leading-relaxed mb-6">
                MilestoneShield AI combines verified deliverable proof with PayPal Sandbox authorization holds.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[#E5E0D8] bg-[#FDFCFB]">
                  <div className="w-7 h-7 rounded-lg bg-[#E5F3EB] text-[#1E4334] flex items-center justify-center shrink-0 mt-0.5">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[#1A2E26]">1. Measurable Acceptance Criteria</h3>
                    <p className="text-[11px] text-[#4A5D53] leading-relaxed">
                      Every milestone defines concrete, objective criteria. Deliverables are reviewed against these specs before funds are disbursed.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[#E5E0D8] bg-[#FDFCFB]">
                  <div className="w-7 h-7 rounded-lg bg-[#E5F3EB] text-[#1E4334] flex items-center justify-center shrink-0 mt-0.5">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[#1A2E26]">2. PayPal Authorization vs Capture</h3>
                    <p className="text-[11px] text-[#4A5D53] leading-relaxed">
                      Orders are created with intent <code>AUTHORIZE</code>. Funds remain safely held by the payment provider and are only captured upon verified milestone approval.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[#E5E0D8] bg-[#FDFCFB]">
                  <div className="w-7 h-7 rounded-lg bg-[#E5F3EB] text-[#1E4334] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[#1A2E26]">3. AI Milestone Assistant (Transparent Prototype)</h3>
                    <p className="text-[11px] text-[#4A5D53] leading-relaxed">
                      AI evaluations are transparently labeled as simulated in this prototype. AI models can never automatically disburse or capture funds.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[11px] text-[#92400E]">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Regulatory notice:</strong> MilestoneShield AI is a milestone project management prototype and not a licensed escrow bank or money transmitter.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E0D8]">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#4A5D53] hover:text-[#1A2E26] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#1E4334] rounded-lg hover:bg-[#163327] disabled:opacity-60 transition-colors shadow-2xs"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Finalizing workspace...</span>
                </>
              ) : step === 3 ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enter Workspace Dashboard</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
