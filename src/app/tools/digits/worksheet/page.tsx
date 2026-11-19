import type { Metadata } from "next";
import { DigitsWorksheet } from "@/tools/13-digits/Worksheet";

export const metadata: Metadata = { title: "کاربرگ ارقام · جعبه‌ابزار تیزهوشان" };

export default function DigitsWorksheetPage() {
  return <DigitsWorksheet />;
}
