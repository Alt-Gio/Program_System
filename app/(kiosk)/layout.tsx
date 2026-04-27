import type { Metadata } from "next";

/**
 * Bare layout for the public-facing kiosk display.
 *
 * Unlike `(main)/layout.tsx`, this route group adds NO sidebar, NO header,
 * NO floating action buttons — it's a clean canvas designed to be opened in
 * a popup window and displayed on a TV. The root `<html>/<body>/<Providers>`
 * still come from `app/layout.tsx`, so Convex providers and the like keep
 * working.
 */
export const metadata: Metadata = {
  title: "Attendance Kiosk · DICT Region V",
  // Don't advertise the kiosk to search engines or social embeds.
  robots: { index: false, follow: false },
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
