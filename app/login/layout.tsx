import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Sign In · DICT Region V", template: "%s · DICT Region V" },
  description: "DICT Region V Program Management System — role-based access portal",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
