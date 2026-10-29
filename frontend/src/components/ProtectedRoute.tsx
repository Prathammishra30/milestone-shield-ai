import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ children, requireOnboarding = true }: ProtectedRouteProps) {
  const { user, profile, isLoading, isEmailVerified, isSupabaseConfigured } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex items-center justify-center">
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-[#E5E0D8] bg-white shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1E4334] border-t-transparent" />
          <span className="text-xs font-medium text-[#4A5D53]">Restoring secure session...</span>
        </div>
      </div>
    );
  }

  // 1. Not authenticated -> redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Unverified email -> redirect to email verification notice
  if (isSupabaseConfigured && !isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  // 3. User has not completed onboarding -> redirect to onboarding flow
  if (requireOnboarding && profile && !profile.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
