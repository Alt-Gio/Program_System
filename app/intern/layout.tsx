import type { Metadata, Viewport } from "next";
import InternShell from "./InternShell";

// Scoped PWA identity for /intern. Splits the previously client-only
// layout so we can export metadata: installing from the intern portal
// gives the intern its own home-screen app with offline shells already
// pre-cached by the root service worker.
export const metadata: Metadata = {
  title: "DTC Intern Portal — DICT Region V",
  description:
    "Intern portal for DICT Region V — habits, tasks, journal, QR check-in. Works offline; entries sync when you reconnect.",
  manifest: "/intern-manifest.json",
  appleWebApp: {
    capable: true,
    title: "DTC Intern",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/intern-icon.svg",
    apple: "/icons/intern-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function InternLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InternShell>{children}</InternShell>;
}
