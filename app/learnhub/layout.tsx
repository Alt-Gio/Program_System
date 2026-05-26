import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./learnhub.css";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], variable: "--font-dm-serif", style: ["normal", "italic"], weight: "400" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "ILCDB LearnHub", template: "%s · LearnHub" },
  description: "DICT Region V Social Learning Platform for ILCDB participants",
  // Override the root manifest so installing from any /learnhub/* page
  // produces a LearnHub PWA (not the DTC Meeting Hall identity).
  manifest: "/learnhub-manifest.json",
  appleWebApp: {
    capable: true,
    title: "LearnHub",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/learnhub-icon.svg",
    shortcut: "/icons/learnhub-icon.svg",
    apple: [
      { url: "/icons/learnhub-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    other: [
      { rel: "mask-icon", url: "/icons/learnhub-icon.svg", color: "#5b6cff" },
    ],
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
};

// Next 14+: themeColor belongs in `viewport`, not `metadata`.
export const viewport: Viewport = {
  themeColor: "#5b6cff",
};

export default function LearnHubRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var t=localStorage.getItem('lh-theme')||'dark';var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.setAttribute('data-theme','dark');})()`
        }}
      />
      <div
        className={`${dmSans.variable} ${dmSerif.variable} ${jakarta.variable}`}
        style={{ fontFamily: "'DM Sans', var(--font-dm-sans), sans-serif" }}
      >
        <LocaleProvider>{children}</LocaleProvider>
      </div>
    </>
  );
}
