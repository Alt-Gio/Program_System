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
  STRINGS,
  type Locale,
  type StringKey,
} from "./translations";

const STORAGE_KEY = "learnhub:locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  // Translator. Falls back to English then to the raw key so missing
  // translations stay visible-but-readable instead of crashing.
  t: (key: StringKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "tl") return stored;
  } catch {
    // private mode etc — fall through
  }
  // Soft language sniff. The PH locale string Chrome reports for many
  // Filipino users is "en-PH", so we only auto-pick Tagalog when the
  // browser explicitly says fil/tl.
  const nav = window.navigator.language?.toLowerCase() ?? "";
  if (nav.startsWith("tl") || nav.startsWith("fil")) return "tl";
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Initialise from default to avoid hydration mismatch; resolve to the
  // stored/sniffed value on mount.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLocaleState(readInitialLocale());
    setHydrated(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STRINGS_TAG_KEY, "1"); // tickle storage
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    // Hint the browser/screen-reader about the new language for the
    // current document. Sub-trees that care can react via the [lang]
    // attribute selector.
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", next === "tl" ? "tl-PH" : "en-PH");
    }
  }, []);

  const t = useCallback(
    (key: StringKey): string => {
      const dict = STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
      const val = (dict as Record<string, string>)[key];
      if (val !== undefined) return val;
      const fallback = (STRINGS[DEFAULT_LOCALE] as Record<string, string>)[key];
      return fallback ?? key;
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  // Suppress hydration mismatch warning on the very first render by
  // forcing a re-render once we've read localStorage.
  void hydrated;

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// Internal storage-tickle key — only here to make sure the localStorage
// write is observed by other tabs that listen to the storage event.
const STRINGS_TAG_KEY = "learnhub:locale:tick";

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Soft fallback for components rendered outside the provider (e.g.
    // some auth surfaces). Returns an identity translator using English.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key) => (STRINGS[DEFAULT_LOCALE] as Record<string, string>)[key] ?? key,
    };
  }
  return ctx;
}
