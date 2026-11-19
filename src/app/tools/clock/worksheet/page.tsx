import type { Metadata } from "next";
import { ClockWorksheet } from "@/tools/08-clock/Worksheet";

export const metadata: Metadata = { title: "کاربرگ ساعت و تقویم · جعبه‌ابزار تیزهوشان" };

export default function ClockWorksheetPage() {
  return <ClockWorksheet />;
}
