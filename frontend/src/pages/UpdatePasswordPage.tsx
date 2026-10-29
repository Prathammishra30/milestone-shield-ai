import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function UpdatePasswordPage() {
  const { updatePassword, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const result = updatePasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: { password?: string; confirmPassword?: string } = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'password') fieldErrors.password = issue.message;
        if (issue.path[0] === 'confirmPassword') fieldErrors.confirmPassword = issue.message;
      }
      setFormErrors(fieldErrors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      await updatePassword(password);
      setIsSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
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
          Set new password
        </h1>
        <p className="mt-2 text-center text-xs text-[#4A5D53]">
          Create a secure, strong password for your workspace account.
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

          {isSuccess ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#E5F3EB] text-[#1E4334] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="font-serif text-lg font-semibold text-[#1A2E26] mb-2">
                Password updated
              </h2>
              <p className="text-xs text-[#4A5D53] leading-relaxed mb-6">
                Your password has been changed successfully. Redirecting you to sign in...
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1E4334] rounded-lg hover:bg-[#163327] transition-colors"
              >
                Sign In Now
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="new-password" className="block text-xs font-medium text-[#1A2E26]">
                  New Password (min 8 chars, 1 uppercase, 1 number)
                </label>
                <div className="mt-1 relative rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7D8F85]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: undefined }));
                    }}
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

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-medium text-[#1A2E26]">
                  Confirm New Password
                </label>
                <div className="mt-1 relative rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7D8F85]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (formErrors.confirmPassword) setFormErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-[#FDFCFB] focus:outline-none focus:ring-2 focus:ring-[#1E4334] ${
                      formErrors.confirmPassword ? 'border-[#DC2626]' : 'border-[#D5CEC2]'
                    }`}
                    placeholder="••••••••"
                  />
                </div>
                {formErrors.confirmPassword && (
                  <p className="mt-1 text-[11px] text-[#DC2626]">{formErrors.confirmPassword}</p>
                )}
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
                      <span>Updating password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
