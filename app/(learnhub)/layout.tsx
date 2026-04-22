import type { Metadata } from "next";
import { Sora, DM_Sans } from "next/font/google";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "ILCDB LearnHub",
  description: "ILCDB Social Learning Platform — DICT Region V",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function LearnHubRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${sora.variable} ${dmSans.variable}`}
      style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
    >
      {children}
    </div>
  );
}
