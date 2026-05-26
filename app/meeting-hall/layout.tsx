import type { Metadata, Viewport } from "next";

// Scoped PWA identity for /meeting-hall. Installing from this surface
// gives the user a "DTC Hall" home-screen app that opens directly into
// the booking page, separate from the unified DICT R5 root install.
export const metadata: Metadata = {
  title: "DTC Meeting Hall — DICT Region V",
  description:
    "Book the Digital Transformation Center meeting hall at DICT Region V. Works offline — submissions sync when you're back online.",
  manifest: "/meeting-hall-manifest.json",
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
  themeColor: "#06060f",
};

export default function MeetingHallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
