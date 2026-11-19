import type { Metadata } from "next";
import { RatioWorksheet } from "@/tools/14-ratio/Worksheet";

export const metadata: Metadata = { title: "کاربرگ نسبت · جعبه‌ابزار تیزهوشان" };

export default function RatioWorksheetPage() {
  return <RatioWorksheet />;
}
