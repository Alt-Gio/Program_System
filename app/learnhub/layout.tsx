import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./learnhub.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], variable: "--font-dm-serif", style: ["normal", "italic"], weight: "400" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "ILCDB LearnHub", template: "%s · LearnHub" },
  description: "DICT Region V Social Learning Platform for ILCDB participants",
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
        {children}
      </div>
    </>
  );
}
