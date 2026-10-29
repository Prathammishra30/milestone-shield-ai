import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { Shield, ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid work email address'),
});

export default function ForgotPasswordPage() {
  const { resetPasswordEmail, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message);
      return;
    }

    setFieldError(undefined);
    setIsSubmitting(true);

    try {
      await resetPasswordEmail(email);
      setIsSent(true);
    } catch {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
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
          </div>
        </div>

        <h1 className="font-serif text-3xl font-semibold text-center tracking-tight text-[#1A2E26]">
          Reset your password
        </h1>
        <p className="mt-2 text-center text-xs text-[#4A5D53]">
          Enter your registered email and we&apos;ll send you secure password reset instructions.
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

          {isSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#E5F3EB] text-[#1E4334] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="font-serif text-lg font-semibold text-[#1A2E26] mb-2">
                Check your email
              </h2>
              <p className="text-xs text-[#4A5D53] leading-relaxed mb-6">
                If an account exists for <strong className="text-[#1A2E26]">{email}</strong>, you will receive password reset instructions shortly.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1E4334] rounded-lg hover:bg-[#163327] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="reset-email" className="block text-xs font-medium text-[#1A2E26]">
                  Account Email Address
                </label>
                <div className="mt-1 relative rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7D8F85]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldError) setFieldError(undefined);
                    }}
                    className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-[#FDFCFB] focus:outline-none focus:ring-2 focus:ring-[#1E4334] ${
                      fieldError ? 'border-[#DC2626]' : 'border-[#D5CEC2]'
                    }`}
                    placeholder="name@company.com"
                  />
                </div>
                {fieldError && <p className="mt-1 text-[11px] text-[#DC2626]">{fieldError}</p>}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-2xs text-xs font-semibold text-white bg-[#1E4334] hover:bg-[#163327] disabled:opacity-60 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending link...</span>
                    </>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-[#1E4334] font-medium hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
