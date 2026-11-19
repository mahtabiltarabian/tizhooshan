import type { Metadata, Viewport } from "next";
// Fonts are bundled, never fetched at runtime (no foreign services).
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";
import { OfflineSupport } from "./OfflineSupport";

export const metadata: Metadata = {
  title: "جعبه‌ابزار تیزهوشان",
  description: "ابزارهای تعاملی برای آموزش مباحث آزمون تیزهوشان",
  // Installable app that works offline (public/manifest.webmanifest, out/sw.js).
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icons/apple-icon.png" },
  appleWebApp: { capable: true, title: "تیزهوشان", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#3d7bf7" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        {children}
        <OfflineSupport />
      </body>
    </html>
  );
}
