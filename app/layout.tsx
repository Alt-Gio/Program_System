import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

// PMS Redesign: DM Sans is scoped to .pms-dashboard via the CSS variable
// (no global font swap so other pages keep Inter).
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-pms",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "DICT Region V – Program Management System",
  description:
    "DICT Region V Program Management System for tracking ICT programs across Bicol Region provinces",
  // Unified DICT R5 manifest. Subapps with distinct identity override this
  // in their own layout: /learnhub/layout.tsx, /meeting-hall/layout.tsx, etc.
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "DICT R5",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/dict-icon.svg",
    shortcut: "/icons/dict-icon.svg",
    apple: [
      // iOS reads the first match. Single SVG covers all sizes on iOS 17+;
      // older iOS will simply ignore unknown icon links without breaking.
      { url: "/icons/dict-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    other: [
      { rel: "mask-icon", url: "/icons/dict-icon.svg", color: "#0a4bd4" },
    ],
  },
  // Explicit format detection blocks — iOS otherwise turns phone numbers
  // into call links and dates into calendar suggestions inside our UI.
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#06060f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Resource hints — reduce TLS/handshake latency for hot external origins.
            Mapbox is preconnected with credentials so tile fetches reuse the socket. */}
        <link rel="preconnect" href="https://api.mapbox.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://events.mapbox.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
        <link rel="dns-prefetch" href="https://drive.google.com" />
        {/* Convex: only emit a hint when the URL is set and is a real https origin
            (skip for local dev http://127.0.0.1:3210 — no benefit there). */}
        {(() => {
          const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
          if (!url.startsWith("https://")) return null;
          let origin = "";
          try { origin = new URL(url).origin; } catch { return null; }
          return (
            <>
              <link rel="preconnect" href={origin} crossOrigin="anonymous" />
              <link rel="dns-prefetch" href={origin} />
            </>
          );
        })()}
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} ${jetbrainsMono.variable} ${dmSans.variable}`}>
        <Providers>
          <ServiceWorkerRegistrar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
