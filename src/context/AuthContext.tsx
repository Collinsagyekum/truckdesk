import { createContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User as AppUser, UserRole } from '../types';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  user: AppUser | null;          // effective user (the impersonated driver when impersonating)
  realUser: AppUser | null;      // the actually-logged-in account
  session: Session | null;
  role: UserRole | null;         // effective role
  loading: boolean;
  isImpersonating: boolean;
  impersonateDriver: (driver: AppUser) => void;
  stopImpersonating: () => void;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// Admin "view as driver": keeps the real (owner) Supabase session — so RLS still
// grants owner-level read access — while the app renders as the chosen driver.
// Persisted in sessionStorage so it survives navigation/HMR within the tab.
const IMPERSONATE_KEY = 'truckdesk.impersonateDriver';

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
  const [impersonated, setImpersonated] = useState<AppUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(IMPERSONATE_KEY);
      return raw ? (JSON.parse(raw) as AppUser) : null;
    } catch {
      return null;
    }
  });

  const impersonateDriver = (driver: AppUser) => {
    const asDriver = { ...driver, role: 'driver' as UserRole };
    sessionStorage.setItem(IMPERSONATE_KEY, JSON.stringify(asDriver));
    setImpersonated(asDriver);
  };

  const stopImpersonating = () => {
    sessionStorage.removeItem(IMPERSONATE_KEY);
    setImpersonated(null);
  };

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

    // NOTE: the callback itself is intentionally NOT async. Making a Supabase
    // DB call synchronously inside onAuthStateChange deadlocks on supabase-js's
    // internal auth lock — the DB request waits for a lock the callback still
    // holds, so `resolveProfile` hangs until our timeout. Deferring the async
    // work with setTimeout(0) lets the callback return and the lock release
    // first, so the profile read runs normally.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setTimeout(async () => {
        try {
          if (session?.user) {
            // Safety net: still guard against any slow lookup so the app never
            // hangs on the loading screen.
            const profile = await Promise.race([
              resolveProfile(session.user),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
            ]);
            if (profile) {
              setUser(profile);
              setRole(profile.role ?? null);
            } else {
              console.warn('[TruckDesk] Profile lookup failed or timed out; continuing without a profile.');
              setUser(null);
              setRole(null);
            }
          } else {
            setUser(null);
            setRole(null);
          }
        } catch (err) {
          console.warn('[TruckDesk] Auth state change error:', err);
          setUser(null);
          setRole(null);
        } finally {
          setLoading(false);
        }
      }, 0);
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
    stopImpersonating();
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setSession(null);
  };

  // Only a real owner may impersonate; otherwise ignore any stored value.
  const canImpersonate = role === 'owner';
  const effectiveImpersonated = canImpersonate ? impersonated : null;
  const isImpersonating = !!effectiveImpersonated;
  const effectiveUser = effectiveImpersonated ?? user;
  const effectiveRole = effectiveImpersonated ? 'driver' : role;

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        realUser: user,
        session,
        role: effectiveRole,
        loading,
        isImpersonating,
        impersonateDriver,
        stopImpersonating,
        signInWithPhone,
        verifyOtp,
        signInWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
export type { AuthContextType };
