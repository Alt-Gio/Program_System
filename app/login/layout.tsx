import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, DM_Serif_Display, JetBrains_Mono } from "next/font/google";
import "./login.css";

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});
const serif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-dm-serif",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jb-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Portal Sign-In · DICT Region V", template: "%s · DICT Region V" },
  description: "DICT Region V Program Management System — role-based access portal",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${sans.variable} ${serif.variable} ${mono.variable} login-root`}
      style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
