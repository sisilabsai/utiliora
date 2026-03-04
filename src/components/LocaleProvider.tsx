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
  getLocaleDirection,
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  getMessage,
  type AppLocale,
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

function resolveInitialLocale(): AppLocale {
  return DEFAULT_LOCALE;
}

function persistLocale(): void {
  if (typeof window === "undefined") return;
  const nextLocale = DEFAULT_LOCALE;

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
    persistLocale();
  }, [locale]);

  const setLocale = useCallback(() => {
    setLocaleState(DEFAULT_LOCALE);
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
