import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { Shield, ArrowRight, Lock, Mail, AlertCircle, Sparkles } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function LoginPage() {
  const { signInWithPassword, loginAsDemoUser, error, clearError, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'email') fieldErrors.email = issue.message;
        if (issue.path[0] === 'password') fieldErrors.password = issue.message;
      }
      setFormErrors(fieldErrors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      await signInWithPassword(email, password);
      navigate(from, { replace: true });
    } catch {
      // Error is stored in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = (role: 'client' | 'freelancer') => {
    loginAsDemoUser(role);
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#1A2E26]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
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
          Sign in to your workspace
        </h1>
        <p className="mt-2 text-center text-xs text-[#4A5D53]">
          Proof before payout. Enter your verified account credentials.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E5E0D8] rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] flex items-start gap-3 text-xs text-[#991B1B]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#1A2E26]">
                Work Email Address
              </label>
              <div className="mt-1 relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7D8F85]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-[#FDFCFB] focus:outline-none focus:ring-2 focus:ring-[#1E4334] focus:border-transparent ${
                    formErrors.email ? 'border-[#DC2626]' : 'border-[#D5CEC2]'
                  }`}
                  placeholder="name@company.com"
                />
              </div>
              {formErrors.email && (
                <p className="mt-1 text-[11px] text-[#DC2626]">{formErrors.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-medium text-[#1A2E26]">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-[#1E4334] hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="mt-1 relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7D8F85]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-[#FDFCFB] focus:outline-none focus:ring-2 focus:ring-[#1E4334] focus:border-transparent ${
                    formErrors.password ? 'border-[#DC2626]' : 'border-[#D5CEC2]'
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {formErrors.password && (
                <p className="mt-1 text-[11px] text-[#DC2626]">{formErrors.password}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-2xs text-xs font-semibold text-white bg-[#1E4334] hover:bg-[#163327] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E4334] disabled:opacity-60 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Login Panel for Evaluators / Hackathon Judges */}
          <div className="mt-6 pt-6 border-t border-[#E5E0D8]">
            <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-semibold text-[#1E4334]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fast Evaluation Logins (Prototype Mode)</span>
            </div>
            <p className="text-[11px] text-[#4A5D53] mb-3">
              Test multi-user isolation and role permissions instantly:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('client')}
                className="flex flex-col items-start p-2.5 rounded-lg border border-[#D5CEC2] hover:border-[#1E4334] hover:bg-[#F5F2EB] text-left transition-all"
              >
                <span className="text-[11px] font-semibold text-[#1A2E26]">Alex Vance</span>
                <span className="text-[10px] text-[#7D8F85]">Client (Proj-001 Owner)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('freelancer')}
                className="flex flex-col items-start p-2.5 rounded-lg border border-[#D5CEC2] hover:border-[#1E4334] hover:bg-[#F5F2EB] text-left transition-all"
              >
                <span className="text-[11px] font-semibold text-[#1A2E26]">Samira Chen</span>
                <span className="text-[10px] text-[#7D8F85]">Freelancer (Deliverables)</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#4A5D53]">
              Don&apos;t have an account?{' '}
              <Link to="/signup" className="font-semibold text-[#1E4334] hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
              Supabase credentials not configured in frontend/.env — running in local verified prototype mode
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
