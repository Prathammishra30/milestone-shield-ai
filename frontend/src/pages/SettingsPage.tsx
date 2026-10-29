import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analytics } from '../lib/analytics';
import {
  ShieldCheck,
  KeyRound,
  Users,
  AlertTriangle,
  User,
  Lock,
  Trash2,
  LogOut,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, signOut, updatePassword, sessionToken } = useAuth();
  const navigate = useNavigate();

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Analytics consent state
  const [analyticsEnabled, setAnalyticsEnabled] = useState(analytics.isTrackingAllowed());

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: 'Password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await updatePassword(newPassword);
      setPasswordStatus({ type: 'success', message: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update password.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleToggleAnalytics = (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    analytics.setConsent(enabled);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE MY ACCOUNT') {
      setDeleteError('Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/users/me', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          confirmation: 'DELETE MY ACCOUNT',
          reason: deleteReason,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || 'Failed to delete account.');
      }

      await signOut();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Account deletion failed.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border-default pb-5">
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
          Account & Platform Settings
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Profile management, account security, legal governance policies, and platform constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── 1. User Profile & Account Identity ── */}
        <section className="rounded-xl border border-border-default bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#1E4334]" />
              <h2 className="font-editorial text-lg font-bold text-ink-900">
                Account Profile & Role
              </h2>
            </div>
            <span className="rounded-full bg-[#E5F3EB] px-2.5 py-0.5 text-xs font-semibold text-[#1E4334] border border-[#A7D7BC] capitalize">
              {profile?.role || 'Client'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 rounded-lg bg-canvas-subtle border border-border-subtle">
              <span className="text-ink-600">Full Name</span>
              <span className="font-semibold text-ink-900">{profile?.fullName || 'Not configured'}</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-canvas-subtle border border-border-subtle">
              <span className="text-ink-600">Work Email</span>
              <span className="font-semibold text-ink-900">{user?.email || profile?.email || 'N/A'}</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-canvas-subtle border border-border-subtle">
              <span className="text-ink-600">User ID</span>
              <code className="font-mono text-[11px] text-ink-700">{user?.id?.slice(0, 16) || 'demo'}...</code>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#D5CEC2] text-xs font-medium text-ink-700 hover:bg-[#F5F2EB] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out of Session
            </button>
          </div>
        </section>

        {/* ── 2. Password & Security Credentials ── */}
        <section className="rounded-xl border border-border-default bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <Lock className="h-5 w-5 text-[#1E4334]" />
            <h2 className="font-editorial text-lg font-bold text-ink-900">
              Security & Credentials
            </h2>
          </div>

          {passwordStatus && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                passwordStatus.type === 'success'
                  ? 'bg-[#E5F3EB] border border-[#A7D7BC] text-[#1E4334]'
                  : 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]'
              }`}
            >
              {passwordStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{passwordStatus.message}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs">
            <div>
              <label htmlFor="new-pw" className="block font-medium text-ink-800 mb-1">
                New Password (min 8 chars)
              </label>
              <input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg border border-[#D5CEC2] bg-canvas-subtle focus:outline-none focus:ring-1 focus:ring-[#1E4334]"
              />
            </div>

            <div>
              <label htmlFor="confirm-pw" className="block font-medium text-ink-800 mb-1">
                Confirm New Password
              </label>
              <input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg border border-[#D5CEC2] bg-canvas-subtle focus:outline-none focus:ring-1 focus:ring-[#1E4334]"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-4 py-2 rounded-lg bg-[#1E4334] text-white font-medium hover:bg-[#163327] disabled:opacity-50 transition-colors"
            >
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>

        {/* ── 3. Privacy, Analytics & Legal Policies ── */}
        <section className="rounded-xl border border-border-default bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <FileText className="h-5 w-5 text-[#1E4334]" />
            <h2 className="font-editorial text-lg font-bold text-ink-900">
              Privacy, Analytics & Legal Policies
            </h2>
          </div>

          <div className="space-y-3 text-xs text-ink-700">
            <div className="flex items-center justify-between p-3 rounded-lg bg-canvas-subtle border border-border-subtle">
              <div>
                <strong className="text-ink-900 block">Product Usage Analytics</strong>
                <span className="text-[11px] text-ink-500">
                  Strictly anonymized event metrics. Message text, deliverables, and tokens are scrubbed.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(e) => handleToggleAnalytics(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#D5CEC2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1E4334]"></div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                to="/privacy"
                target="_blank"
                className="flex items-center justify-between p-3 rounded-lg border border-[#D5CEC2] hover:bg-[#F5F2EB] text-ink-900 font-medium transition-colors"
              >
                <span>Privacy Policy</span>
                <ExternalLink className="w-3.5 h-3.5 text-ink-500" />
              </Link>

              <Link
                to="/terms"
                target="_blank"
                className="flex items-center justify-between p-3 rounded-lg border border-[#D5CEC2] hover:bg-[#F5F2EB] text-ink-900 font-medium transition-colors"
              >
                <span>Terms of Service</span>
                <ExternalLink className="w-3.5 h-3.5 text-ink-500" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── 4. Danger Zone: Safe Account Deletion ── */}
        <section className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2]/40 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#FCA5A5] pb-3 text-[#991B1B]">
            <Trash2 className="h-5 w-5 text-[#DC2626]" />
            <h2 className="font-editorial text-lg font-bold">
              Danger Zone: Account Lifecycle
            </h2>
          </div>

          <p className="text-xs text-[#7F1D1D] leading-relaxed">
            Closing your account permanently removes personal data (full name, email, avatar). In compliance with tax and financial record-keeping standards, immutable audit trails and transaction records are retained in anonymized format without cascading deletion.
          </p>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 rounded-lg bg-[#DC2626] text-white text-xs font-semibold hover:bg-[#B91C1C] transition-colors"
          >
            Delete Workspace Account
          </button>
        </section>

        {/* ── 5. Policy Engine Constraints (Preserved) ── */}
        <section className="rounded-xl border border-border-default bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <ShieldCheck className="h-5 w-5 text-[#1E4334]" />
            <h2 className="font-editorial text-lg font-bold text-ink-900">
              Payment Policy Engine Constraints
            </h2>
          </div>

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
                <p className="mt-0.5 text-ink-600">All PayPal orders are created with <code className="font-mono text-[11px] bg-surface px-1 py-0.5 rounded">INTENT=AUTHORIZE</code> (not immediate capture). Funds are held by PayPal Sandbox, not in a proprietary escrow pool.</p>
              </div>
            </li>
          </ul>
        </section>

        {/* ── 6. Gateway & Model Configuration (Preserved) ── */}
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
                  SANDBOX MODE (INTENT: AUTHORIZE)
                </span>
              </div>
              <p className="text-ink-600">Base URL: <code className="font-mono text-[11px]">https://api-m.sandbox.paypal.com</code></p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-800">PostgreSQL & RLS</span>
                <span className="rounded bg-[#E5F3EB] px-2 py-0.5 text-[10px] font-bold text-[#1E4334] border border-[#A7D7BC]">
                  MIGRATIONS READY
                </span>
              </div>
              <p className="text-ink-600">Row-level security policies enforce multi-tenant isolation and financial mutation locks.</p>
            </div>
          </div>
        </section>

        {/* ── 7. Hackathon Team Division (Preserved) ── */}
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

      {/* ── Modal: Double Confirmation for Account Deletion ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E5E0D8] space-y-4">
            <div className="flex items-center gap-3 text-[#DC2626]">
              <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-ink-900">
                Confirm Account Deletion
              </h3>
            </div>

            <div className="text-xs text-ink-600 space-y-2 leading-relaxed">
              <p>
                This action is <strong className="text-ink-900">permanent and irreversible</strong>.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-ink-700">
                <li>Your profile credentials and work email will be scrubbed.</li>
                <li>Your active contracts will be archived.</li>
                <li>Past payment records and audit hashes remain archived in anonymized state to satisfy legal compliance.</li>
              </ul>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[11px] text-[#DC2626]">
                {deleteError}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-medium text-ink-800">
                Type <strong className="text-[#DC2626]">DELETE MY ACCOUNT</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="w-full px-3 py-2 text-xs border border-[#D5CEC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
              />

              <label className="block text-xs font-medium text-ink-800 pt-2">
                Reason for leaving (optional):
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Switching tools, finished project..."
                className="w-full px-3 py-2 text-xs border border-[#D5CEC2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E4334]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmationText('');
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[#D5CEC2] hover:bg-[#F5F2EB] text-ink-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmationText !== 'DELETE MY ACCOUNT'}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
