import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import UserBadge from "@/components/auth/UserBadge";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DICT Region V – Program Management System",
  description:
    "DICT Region V Program Management System for tracking ICT programs across Bicol Region provinces",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <UserBadge />
          {children}
        </Providers>
      </body>
    </html>
  );
}
