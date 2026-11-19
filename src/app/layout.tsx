import type { Metadata } from "next";
// Fonts are bundled, never fetched at runtime (no foreign services).
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "جعبه‌ابزار تیزهوشان",
  description: "ابزارهای تعاملی برای آموزش مباحث آزمون تیزهوشان",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
