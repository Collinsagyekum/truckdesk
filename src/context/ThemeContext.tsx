import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextType {
  /** What the user chose: follow the system, or force light/dark. */
  theme: ThemePreference;
  /** What's actually applied right now (system resolved to light or dark). */
  resolvedTheme: ResolvedTheme;
  setTheme: (t: ThemePreference) => void;
}

const STORAGE_KEY = 'truckdesk-theme';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore (private mode, etc.) */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStored());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(readStored()));

  // Apply the resolved theme to <html> and keep it in sync with the choice.
  useEffect(() => {
    const applied = resolve(theme);
    setResolvedTheme(applied);
    try {
      document.documentElement.setAttribute('data-theme', applied);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // When following the system, react to the OS flipping light/dark live.
  useEffect(() => {
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const applied: ResolvedTheme = mq.matches ? 'dark' : 'light';
      setResolvedTheme(applied);
      try {
        document.documentElement.setAttribute('data-theme', applied);
      } catch {
        /* ignore */
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
