import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import type { User, Session } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar?: string;
  avatar_url?: string;
  role: 'rider' | 'driver' | 'admin';
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoggedIn: boolean;
  loading: boolean;
  operationLoading: boolean;
  // Email + Password
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (name: string, email: string, password: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  // OTP
  sendOTP: (email: string) => Promise<{ error: string | null }>;
  verifyOTP: (email: string, otp: string) => Promise<{ error: string | null }>;
  // Google OAuth
  signInWithGoogle: () => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUser(supaUser: User, profile?: { username?: string; email?: string; phone?: string; avatar_url?: string } | null): AppUser {
  return {
    id: supaUser.id,
    name: profile?.username ?? supaUser.user_metadata?.full_name ?? supaUser.email?.split('@')[0] ?? 'مستخدم',
    phone: profile?.phone ?? supaUser.phone ?? supaUser.user_metadata?.phone ?? '',
    email: supaUser.email ?? profile?.email ?? '',
    avatar: profile?.avatar_url ?? supaUser.user_metadata?.avatar_url,
    avatar_url: profile?.avatar_url ?? supaUser.user_metadata?.avatar_url,
    role: 'rider',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  const fetchProfile = async (supaUser: User): Promise<AppUser> => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, email, phone, avatar_url')
        .eq('id', supaUser.id)
        .single();
      return mapUser(supaUser, profile);
    } catch {
      return mapUser(supaUser, null);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        const appUser = await fetchProfile(s.user);
        setUser(appUser);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (s?.user) {
        const appUser = await fetchProfile(s.user);
        setUser(appUser);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    setOperationLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } finally {
      setOperationLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ error: string | null; needsConfirmation?: boolean }> => {
    setOperationLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });
      if (error) return { error: error.message };
      if (data.user && !data.session) {
        return { error: null, needsConfirmation: true };
      }
      // Update profile username
      if (data.user) {
        await supabase
          .from('user_profiles')
          .update({ username: name })
          .eq('id', data.user.id);
      }
      return { error: null };
    } finally {
      setOperationLoading(false);
    }
  };

  const sendOTP = async (email: string): Promise<{ error: string | null }> => {
    setOperationLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) return { error: error.message };
      return { error: null };
    } finally {
      setOperationLoading(false);
    }
  };

  const verifyOTP = async (email: string, otp: string): Promise<{ error: string | null }> => {
    setOperationLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });
      if (error) return { error: error.message };
      return { error: null };
    } finally {
      setOperationLoading(false);
    }
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    setOperationLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'onspaceapp://auth/callback',
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (e: any) {
      return { error: e.message ?? 'فشل تسجيل الدخول بـ Google' };
    } finally {
      setOperationLoading(false);
    }
  };

  const logout = async () => {
    setOperationLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } finally {
      setOperationLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, session, isLoggedIn: !!user, loading, operationLoading,
      login, register, sendOTP, verifyOTP, signInWithGoogle, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be within AuthProvider');
  return ctx;
}
