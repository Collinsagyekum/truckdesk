import { createContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User as AppUser, UserRole } from '../types';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_BYPASS_USER: AppUser = {
  id: 'a638fe0d-22ce-4fe1-a61e-8162ef3006a5',
  full_name: 'Kwame Agyekum',
  email: 'cagyekum26@gmail.com',
  phone: '+12815550000',
  role: 'owner',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as AppUser;

function isDevBypass(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.href.includes('devbypass=');
}

function isDevDriver(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.href.includes('devbypass=driver');
}

// Fetch the user's profile row. If none exists, create one (owner by default).
async function resolveProfile(supabaseUser: SupabaseUser): Promise<AppUser | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', supabaseUser.id)
      .maybeSingle();

    if (error) {
      console.warn('Profile fetch error:', error.message);
    }
    if (data) return data as AppUser;

    // No row yet — create a default owner profile for this auth user
    const newProfile = {
      id: supabaseUser.id,
      email: supabaseUser.email ?? null,
      phone: supabaseUser.phone ?? null,
      full_name: supabaseUser.email?.split('@')[0] ?? 'New User',
      role: 'owner' as UserRole,
    };
    const { data: inserted, error: insertErr } = await supabase
      .from('users')
      .insert(newProfile)
      .select('*')
      .maybeSingle();

    if (insertErr) {
      console.warn('Profile insert error:', insertErr.message);
      // Fall back to an in-memory profile so the app can still route
      return { ...newProfile, created_at: '', updated_at: '' } as AppUser;
    }
    return inserted as AppUser;
  } catch (e) {
    console.warn('resolveProfile threw:', e);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dev bypass short-circuit
    if (isDevBypass()) {
      if (isDevDriver()) {
        setUser({ ...DEV_BYPASS_USER, role: 'driver' } as AppUser);
        setRole('driver');
      } else {
        setUser(DEV_BYPASS_USER);
        setRole('owner');
      }
      setLoading(false);
      return;
    }

    // Safety net: never let loading hang more than 6s
    const safety = setTimeout(() => setLoading(false), 6000);

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user) {
          const profile = await resolveProfile(session.user);
          setUser(profile);
          setRole(profile?.role ?? null);
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err) {
        console.warn('Auth init error:', err);
        setUser(null);
        setRole(null);
      } finally {
        clearTimeout(safety);
        setLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const profile = await resolveProfile(session.user);
        setUser(profile);
        setRole(profile?.role ?? null);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error: error as Error | null };
  };

  const verifyOtp = async (phoneOrEmail: string, token: string) => {
    const isEmail = phoneOrEmail.includes('@');
    const { error } = await supabase.auth.verifyOtp(
      isEmail
        ? { email: phoneOrEmail, token, type: 'email' }
        : { phone: phoneOrEmail, token, type: 'sms' }
    );
    return { error: error as Error | null };
  };

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, role, loading, signInWithPhone, verifyOtp, signInWithEmail, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
export type { AuthContextType };
