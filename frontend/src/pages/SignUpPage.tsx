import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth, type UserRole } from '../context/AuthContext';
import { Shield, ArrowRight, Lock, Mail, User, CheckCircle2, AlertCircle, Briefcase, UserCheck } from 'lucide-react';

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid work email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  role: z.enum(['client', 'freelancer']),
  agreeTerms: z.literal(true, {
    message: 'You must agree to the Terms of Service and Privacy Policy',
  }),
});

export default function SignUpPage() {
  const { signUp, error, clearError, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signedUpSuccess, setSignedUpSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const result = signUpSchema.safeParse({
      fullName,
      email,
      password,
      role,
      agreeTerms,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0]?.toString() || 'general';
        fieldErrors[fieldName] = issue.message;
      }
      setFormErrors(fieldErrors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      await signUp(email, password, fullName, role);
      if (isSupabaseConfigured) {
        setSignedUpSuccess(true);
      } else {
        navigate('/onboarding', { replace: true });
      }
    } catch {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  if (signedUpSuccess) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#1A2E26]">
        <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
          <div className="bg-white py-10 px-8 shadow-sm border border-[#E5E0D8] rounded-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-[#E5F3EB] text-[#1E4334] flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-[#1A2E26] mb-2">
              Verification Email Sent
            </h1>
            <p className="text-xs text-[#4A5D53] leading-relaxed mb-6">
              We&apos;ve sent a confirmation link to <strong className="text-[#1A2E26]">{email}</strong>.
              Please check your inbox to activate your account and verify your identity before accessing protected workspaces.
            </p>
            <div className="space-y-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1E4334] rounded-lg hover:bg-[#163327] transition-colors"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#1A2E26]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1E4334] flex items-center justify-center text-[#E5F3EB] shadow-sm">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight text-[#1A2E26]">
              MilestoneShield
            </span>
            <span className="text-[10px] font-sans font-semibold tracking-wider uppercase text-[#1E4334] block -mt-1">
              AI Escrow & Proof
            </span>
          </div>
        </div>

        <h1 className="font-serif text-3xl font-semibold text-center tracking-tight text-[#1A2E26]">
          Create your account
        </h1>
        <p className="mt-1 text-center text-xs text-[#4A5D53]">
          Join MilestoneShield AI for verified milestone payouts and protected contracts.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E5E0D8] rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] flex items-start gap-3 text-xs text-[#991B1B]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Role Selection */}
            <div>
              <label className="block text-xs font-medium text-[#1A2E26] mb-1.5">
                Primary Account Role
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole('client')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    role === 'client'
                      ? 'border-[#1E4334] bg-[#E5F3EB]/40 ring-1 ring-[#1E4334]'
                      : 'border-[#D5CEC2] hover:bg-[#F5F2EB]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2E26]">
                    <Briefcase className="w-3.5 h-3.5 text-[#1E4334]" />
                    <span>Client / Buyer</span>
                  </div>
                  <span className="text-[10px] text-[#4A5D53] leading-tight">
                    Create contracts & authorize milestone funds
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('freelancer')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    role === 'freelancer'
                      ? 'border-[#1E4334] bg-[#E5F3EB]/40 ring-1 ring-[#1E4334]'
                      : 'border-[#D5CEC2] hover:bg-[#F5F2EB]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2E26]">
                    <UserCheck className="w-3.5 h-3.5 text-[#1E4334]" />
                    <span>Freelancer / Builder</span>
                  </div>
                  <span className="text-[10px] text-[#4A5D53] leading-tight">
                    Submit deliverables & receive released payouts
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-xs font-medium text-[#1A2E26]">
                Full Legal Name
              </label>
              <div className="mt-1 relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7D8F85]">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-[#FDFCFB] focus:outline-none focus:ring-2 focus:ring-[#1E4334] ${
                    formErrors.fullName ? 'border-[#DC2626]' : 'border-[#D5CEC2]'
                  }`}
                  placeholder="e.g. Alex Vance"
                />
              </div>
              {formErrors.fullName && (
                <p className="mt-1 text-[11px] text-[#DC2626]">{formErrors.fullName}</p>
              )}
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-xs font-medium text-[#1A2E26]">
                Work Email Address
              </label>
              <div className="mt-1 relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7D8F85]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-[#FDFCFB] focus:outline-none focus:ring-2 focus:ring-[#1E4334] ${
                    formErrors.email ? 'border-[#DC2626]' : 'border-[#D5CEC2]'
                  }`}
                  placeholder="alex@company.com"
                />
              </div>
              {formErrors.email && (
                <p className="mt-1 text-[11px] text-[#DC2626]">{formErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-xs font-medium text-[#1A2E26]">
                Password (min 8 chars, 1 uppercase, 1 number)
              </label>
              <div className="mt-1 relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7D8F85]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-[#FDFCFB] focus:outline-none focus:ring-2 focus:ring-[#1E4334] ${
                    formErrors.password ? 'border-[#DC2626]' : 'border-[#D5CEC2]'
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {formErrors.password && (
                <p className="mt-1 text-[11px] text-[#DC2626]">{formErrors.password}</p>
              )}
            </div>

            {/* Terms of Service agreement checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-[#1E4334] rounded border-[#D5CEC2] focus:ring-[#1E4334]"
                />
                <span className="text-[11px] text-[#4A5D53] leading-relaxed">
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" className="font-semibold text-[#1E4334] hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" target="_blank" className="font-semibold text-[#1E4334] hover:underline">
                    Privacy Policy
                  </Link>
                  . I understand MilestoneShield is a milestone management prototype and not a regulated escrow bank.
                </span>
              </label>
              {formErrors.agreeTerms && (
                <p className="mt-1 text-[11px] text-[#DC2626]">{formErrors.agreeTerms}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-2xs text-xs font-semibold text-white bg-[#1E4334] hover:bg-[#163327] disabled:opacity-60 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#4A5D53]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#1E4334] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
