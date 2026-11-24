import type { Metadata, Viewport } from "next";
// Fonts are bundled, never fetched at runtime (no foreign services).
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/noto-kufi-arabic/700.css";
import "@fontsource/noto-kufi-arabic/800.css";
import "./globals.css";
import { PracticeBar } from "@/practice/PracticeBar";
import { OfflineSupport } from "./OfflineSupport";

export const metadata: Metadata = {
  title: "جعبه‌ابزار تیزهوشان",
  description: "ابزارهای تعاملی برای آموزش مباحث آزمون تیزهوشان",
  // Installable app that works offline (public/manifest.webmanifest, out/sw.js).
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icons/apple-icon.png" },
  appleWebApp: { capable: true, title: "تیزهوشان", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#4f46e5" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <PracticeBar />
        {children}
        <OfflineSupport />
      </body>
    </html>
  );
}
