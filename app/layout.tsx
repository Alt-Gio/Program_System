import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import UserBadge from "@/components/auth/UserBadge";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DICT Region V – Program Management System",
  description:
    "DICT Region V Program Management System for tracking ICT programs across Bicol Region provinces",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "DTC Hall",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/dtc-icon.svg",
    apple: "/icons/dtc-icon.svg",
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
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <ServiceWorkerRegistrar />
          <UserBadge />
          {children}
        </Providers>
      </body>
    </html>
  );
}
