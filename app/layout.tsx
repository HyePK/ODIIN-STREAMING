import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ODIIN STREAMING",
  description: "Watch live ODIIN events, explore replays, and manage broadcasts.",
  applicationName: "ODIIN STREAMING",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ODIIN STREAMING",
    statusBarStyle: "black-translucent",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/odiin-mark.svg",
    shortcut: "/odiin-mark.svg",
    apple: "/odiin-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
