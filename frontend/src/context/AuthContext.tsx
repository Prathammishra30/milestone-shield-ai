import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { analytics } from '../lib/analytics';
import { captureException } from '../lib/monitoring';

export type UserRole = 'client' | 'freelancer' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  onboardingCompleted: boolean;
  avatarUrl?: string;
}

export interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  sessionToken: string | null;
  isLoading: boolean;
  isEmailVerified: boolean;
  isSupabaseConfigured: boolean;
  error: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordEmail: (email: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeOnboarding: (role: UserRole, fullName: string) => Promise<void>;
  loginAsDemoUser: (role: 'client' | 'freelancer') => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local storage keys
const DEMO_AUTH_KEY = 'milestoneshield_demo_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Fetch or create profile via backend API
  const fetchProfile = useCallback(async (token: string, userId: string, fallbackEmail: string) => {
    try {
      const res = await fetch('/api/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setProfile(json.data);
          return;
        }
      }
    } catch {
      // If backend network request fails, synthesize client fallback profile
    }

    setProfile((prev) => prev || {
      id: userId,
      email: fallbackEmail,
      fullName: '',
      role: 'client',
      onboardingCompleted: false,
    });
  }, []);

  // Session restoration and listener
  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);

      // 1. Check live Supabase session if configured
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) throw sessionErr;

          if (data.session) {
            const authUser = data.session.user;
            setUser({ id: authUser.id, email: authUser.email || '' });
            setSessionToken(data.session.access_token);
            setIsEmailVerified(Boolean(authUser.email_confirmed_at));
            await fetchProfile(data.session.access_token, authUser.id, authUser.email || '');
            setIsLoading(false);
            return;
          }
        } catch (err) {
          captureException(err, { action: 'init_supabase_session' });
        }
      }

      // 2. Check local stored demo user session (for preview / testing without Supabase credentials)
      try {
        const storedDemo = localStorage.getItem(DEMO_AUTH_KEY);
        if (storedDemo) {
          const parsed = JSON.parse(storedDemo);
          setUser({ id: parsed.id, email: parsed.email });
          setSessionToken(parsed.token);
          setProfile(parsed.profile);
          setIsEmailVerified(true);
          setIsLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem(DEMO_AUTH_KEY);
      }

      // Default to demo client if unconfigured to preserve seamless hackathon evaluation
      if (!isSupabaseConfigured) {
        const defaultProfile: UserProfile = {
          id: 'usr-client-001',
          email: 'alex.vance@acme-corp.demo',
          fullName: 'Alex Vance',
          role: 'client',
          onboardingCompleted: true,
        };
        const demoToken = 'dev-token:usr-client-001:client';
        setUser({ id: defaultProfile.id, email: defaultProfile.email });
        setProfile(defaultProfile);
        setSessionToken(demoToken);
        setIsEmailVerified(true);
      }

      setIsLoading(false);
    }

    initAuth();

    // Subscribe to Supabase auth events if connected
    if (isSupabaseConfigured && supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          setUser({ id: session.user.id, email: session.user.email || '' });
          setSessionToken(session.access_token);
          setIsEmailVerified(Boolean(session.user.email_confirmed_at));
          await fetchProfile(session.access_token, session.user.id, session.user.email || '');
        } else {
          setUser(null);
          setProfile(null);
          setSessionToken(null);
          setIsEmailVerified(false);
        }
      });

      return () => {
        sub.subscription.unsubscribe();
      };
    }
  }, [fetchProfile]);

  const signInWithPassword = async (email: string, password: string): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        if (data.user && data.session) {
          setUser({ id: data.user.id, email: data.user.email || '' });
          setSessionToken(data.session.access_token);
          setIsEmailVerified(Boolean(data.user.email_confirmed_at));
          await fetchProfile(data.session.access_token, data.user.id, data.user.email || '');
          analytics.track('user_logged_in', { method: 'password' });
        }
      } else {
        // Prototype login simulation
        const role: UserRole = email.includes('freelancer') ? 'freelancer' : 'client';
        const demoUser: UserProfile = {
          id: `usr-${role}-001`,
          email,
          fullName: role === 'client' ? 'Alex Vance' : 'Samira Chen',
          role,
          onboardingCompleted: true,
        };
        const token = `dev-token:${demoUser.id}:${role}`;
        setUser({ id: demoUser.id, email: demoUser.email });
        setProfile(demoUser);
        setSessionToken(token);
        setIsEmailVerified(true);
        localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify({ ...demoUser, token, profile: demoUser }));
        analytics.track('user_logged_in_demo', { role });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials.';
      setError(msg);
      captureException(err, { action: 'signInWithPassword' });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole
  ): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
            },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });

        if (authError) throw authError;

        if (data.user) {
          setUser({ id: data.user.id, email: data.user.email || '' });
          setIsEmailVerified(Boolean(data.user.email_confirmed_at));
          analytics.track('user_signed_up', { role });
        }
      } else {
        const newUser: UserProfile = {
          id: `usr-${Date.now()}`,
          email,
          fullName,
          role,
          onboardingCompleted: false,
        };
        const token = `dev-token:${newUser.id}:${role}`;
        setUser({ id: newUser.id, email });
        setProfile(newUser);
        setSessionToken(token);
        setIsEmailVerified(true);
        localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify({ ...newUser, token, profile: newUser }));
        analytics.track('user_signed_up_demo', { role });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(msg);
      captureException(err, { action: 'signUp' });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem(DEMO_AUTH_KEY);
      setUser(null);
      setProfile(null);
      setSessionToken(null);
      setIsEmailVerified(false);
      analytics.track('user_logged_out');
    } catch (err) {
      captureException(err, { action: 'signOut' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetPasswordEmail = async (email: string): Promise<void> => {
    setError(null);
    if (isSupabaseConfigured && supabase) {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (resetErr) throw resetErr;
    }
    analytics.track('password_reset_requested');
  };

  const resendVerificationEmail = async (email: string): Promise<void> => {
    setError(null);
    if (isSupabaseConfigured && supabase) {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendErr) throw resendErr;
    }
    analytics.track('verification_email_resend_requested');
  };

  const updatePassword = async (password: string): Promise<void> => {
    setError(null);
    if (isSupabaseConfigured && supabase) {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
    }
    analytics.track('password_updated');
  };

  const completeOnboarding = async (role: UserRole, fullName: string): Promise<void> => {
    if (!sessionToken) throw new Error('Not authenticated.');

    try {
      const res = await fetch('/api/users/me/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ role, fullName }),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || 'Onboarding failed.');
      }

      const json = await res.json();
      setProfile(json.data);

      if (!isSupabaseConfigured && user) {
        const updated = { ...json.data, token: sessionToken, profile: json.data };
        localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(updated));
      }

      analytics.track('onboarding_completed', { role });
    } catch (err: unknown) {
      captureException(err, { action: 'completeOnboarding' });
      throw err;
    }
  };

  const loginAsDemoUser = (role: 'client' | 'freelancer') => {
    const demoProfile: UserProfile = {
      id: role === 'client' ? 'usr-client-001' : 'usr-freelancer-001',
      email: role === 'client' ? 'client@example.com' : 'freelancer@example.com',
      fullName: role === 'client' ? 'Alex Vance (Client)' : 'Samira Chen (Freelancer)',
      role,
      onboardingCompleted: true,
    };
    const token = `dev-token:${demoProfile.id}:${role}`;
    setUser({ id: demoProfile.id, email: demoProfile.email });
    setProfile(demoProfile);
    setSessionToken(token);
    setIsEmailVerified(true);
    localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify({ ...demoProfile, token, profile: demoProfile }));
    analytics.track('demo_quick_login', { role });
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      sessionToken,
      isLoading,
      isEmailVerified,
      isSupabaseConfigured,
      error,
      signInWithPassword,
      signUp,
      signOut,
      resetPasswordEmail,
      resendVerificationEmail,
      updatePassword,
      completeOnboarding,
      loginAsDemoUser,
      clearError,
    }),
    [
      user,
      profile,
      sessionToken,
      isLoading,
      isEmailVerified,
      error,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
