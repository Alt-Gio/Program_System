export type Theme = "light" | "dark" | "system";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (theme === "dark" || (theme === "system" && systemDark)) {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
  try { localStorage.setItem("lh-theme", theme); } catch {}
}

export function getStoredTheme(): Theme {
  try { return (localStorage.getItem("lh-theme") as Theme) || "dark"; } catch { return "dark"; }
}

export const THEME_INIT_SCRIPT = `(function(){var t=localStorage.getItem('lh-theme')||'dark';var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.setAttribute('data-theme','dark');})()`
