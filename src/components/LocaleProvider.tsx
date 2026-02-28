"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  detectLocaleFromNavigator,
  getLocaleDirection,
  getMessage,
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  type AppLocale,
  resolveLocale,
} from "@/lib/i18n";

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  children: ReactNode;
}

declare global {
  interface Window {
    __UTILIORA_LOCALE__?: string;
  }
}

function readLocaleFromCookie(): AppLocale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_KEY}=([^;]+)`));
  if (!match?.[1]) return null;
  return resolveLocale(decodeURIComponent(match[1]), DEFAULT_LOCALE);
}

function resolveInitialLocale(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const bootLocale = window.__UTILIORA_LOCALE__;
  if (bootLocale) return resolveLocale(bootLocale, DEFAULT_LOCALE);

  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) return resolveLocale(stored, DEFAULT_LOCALE);
  } catch {
    // Ignore storage failures.
  }

  const cookieLocale = readLocaleFromCookie();
  if (cookieLocale) return cookieLocale;

  return detectLocaleFromNavigator(DEFAULT_LOCALE);
}

function persistLocale(nextLocale: AppLocale): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  } catch {
    // Ignore storage failures.
  }

  try {
    document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Ignore cookie write failures.
  }

  document.documentElement.lang = nextLocale;
  document.documentElement.dir = getLocaleDirection(nextLocale);
  window.__UTILIORA_LOCALE__ = nextLocale;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<AppLocale>(resolveInitialLocale);

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(resolveLocale(nextLocale, DEFAULT_LOCALE));
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>, fallback?: string) =>
      getMessage(locale, key, params, fallback),
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {
        // No-op outside provider.
      },
      t: (key: string, _params?: Record<string, string | number>, fallback?: string) => fallback ?? key,
    };
  }
  return context;
}
