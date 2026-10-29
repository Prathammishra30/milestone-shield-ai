import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const { user, signOut, resendVerificationEmail } = useAuth();
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const handleResend = async () => {
    if (!user?.email || resending) return;
    setResending(true);
    try {
      await resendVerificationEmail(user.email);
      setResendSent(true);
      setTimeout(() => setResendSent(false), 8000);
    } catch {
      // Ignored
    } finally {
      setResending(false);
    }
  };

  const handleCheckAgain = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#1A2E26]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-10 px-8 shadow-sm border border-[#E5E0D8] rounded-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#E5F3EB] text-[#1E4334] flex items-center justify-center mx-auto mb-5 shadow-2xs">
            <Mail className="w-7 h-7" />
          </div>

          <h1 className="font-serif text-2xl font-semibold text-[#1A2E26] mb-2">
            Verify your email address
          </h1>

          <p className="text-xs text-[#4A5D53] leading-relaxed mb-6">
            We sent a verification link to <strong className="text-[#1A2E26]">{user?.email || 'your email'}</strong>.
            To ensure multi-tenant security and prevent unauthorized access to milestone payment workflows, please click the link in your email to verify your identity.
          </p>

          {resendSent && (
            <div className="mb-5 p-3 rounded-lg bg-[#E5F3EB] border border-[#A7D7BC] flex items-center justify-center gap-2 text-xs text-[#1E4334]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Verification email re-sent! Please check your spam folder if it doesn&apos;t arrive.</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleCheckAgain}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#1E4334] rounded-lg hover:bg-[#163327] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              I&apos;ve Verified — Continue to Workspace
            </button>

            <button
              onClick={handleResend}
              disabled={resending || resendSent}
              className="w-full py-2.5 px-4 text-xs font-medium text-[#1A2E26] bg-[#F5F2EB] border border-[#D5CEC2] rounded-lg hover:bg-[#EAE4D9] disabled:opacity-50 transition-colors"
            >
              {resending ? 'Sending...' : 'Resend Verification Email'}
            </button>

            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-[#7D8F85] hover:text-[#DC2626] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out & Use Different Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
