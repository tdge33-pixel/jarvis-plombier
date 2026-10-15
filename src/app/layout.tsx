import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Jarvis Plombier", template: "%s · Jarvis Plombier" },
  description: "Jarvis s'occupe de l'administratif pendant que vous vous occupez de vos clients.",
};

export const viewport: Viewport = {
  themeColor: "#0b1630",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
