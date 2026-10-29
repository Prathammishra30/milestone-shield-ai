import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

// Code-split workspace pages
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const MilestonesPage = lazy(() => import('./pages/MilestonesPage'));
const SubmissionsPage = lazy(() => import('./pages/SubmissionsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Code-split authentication & lifecycle pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const UpdatePasswordPage = lazy(() => import('./pages/UpdatePasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-2.5 rounded-lg border border-border-default bg-surface px-4 py-2.5 shadow-2xs">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1E4334] border-t-transparent" />
        <span className="text-xs font-medium text-ink-600">Loading workspace...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Public Auth & Informational Routes ── */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/update-password" element={<UpdatePasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />

              {/* ── Protected Onboarding (Bypasses onboarding check itself) ── */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute requireOnboarding={false}>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Protected Workspace Routes ── */}
              <Route
                element={
                  <ProtectedRoute requireOnboarding={true}>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<OverviewPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="milestones" element={<MilestonesPage />} />
                <Route path="submissions" element={<SubmissionsPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* ── 404 Catch-All ── */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
