// Login tweaks: persisted user-tuning for the sign-in page.
// Stored under a single localStorage key so the whole object round-trips.

export type AccentKey = "orange" | "cobalt" | "emerald" | "rose" | "violet";

export interface LoginTweaks {
  accent: AccentKey;
  showBranding: boolean;
}

export const DEFAULT_TWEAKS: LoginTweaks = {
  accent: "orange",
  showBranding: true,
};

export const ACCENTS: Record<
  AccentKey,
  { label: string; hex: string; oklch: string }
> = {
  orange:  { label: "DICT Orange", hex: "#f97316", oklch: "oklch(72% 0.17 50)" },
  cobalt:  { label: "Cobalt",      hex: "#3b82f6", oklch: "oklch(68% 0.18 250)" },
  emerald: { label: "Emerald",     hex: "#10b981", oklch: "oklch(70% 0.15 160)" },
  rose:    { label: "Rose",        hex: "#f43f5e", oklch: "oklch(68% 0.20 10)"  },
  violet:  { label: "Violet",      hex: "#8b5cf6", oklch: "oklch(66% 0.22 290)" },
};

const STORAGE_KEY = "dict_login_tweaks";
const ADMIN_UNLOCK_KEY = "dict_login_admin_unlocked";
const ADMIN_UNLOCK_TTL_MS = 24 * 60 * 60 * 1000;

export function readTweaks(): LoginTweaks {
  if (typeof window === "undefined") return DEFAULT_TWEAKS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TWEAKS;
    const parsed = JSON.parse(raw) as Partial<LoginTweaks>;
    return {
      accent: parsed.accent && parsed.accent in ACCENTS ? parsed.accent : DEFAULT_TWEAKS.accent,
      showBranding: typeof parsed.showBranding === "boolean" ? parsed.showBranding : DEFAULT_TWEAKS.showBranding,
    };
  } catch {
    return DEFAULT_TWEAKS;
  }
}

export function writeTweaks(t: LoginTweaks): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* ignore quota errors */
  }
}

export function isAdminUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(ADMIN_UNLOCK_KEY);
    if (!raw) return false;
    const ts = Number.parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < ADMIN_UNLOCK_TTL_MS;
  } catch {
    return false;
  }
}

export function setAdminUnlocked(unlocked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (unlocked) window.localStorage.setItem(ADMIN_UNLOCK_KEY, String(Date.now()));
    else window.localStorage.removeItem(ADMIN_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}
