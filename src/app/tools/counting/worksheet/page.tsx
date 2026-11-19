import type { Metadata } from "next";
import { CountingWorksheet } from "@/tools/17-counting/Worksheet";

export const metadata: Metadata = { title: "کاربرگ چیدمان و شمارش · جعبه‌ابزار تیزهوشان" };

export default function CountingWorksheetPage() {
  return <CountingWorksheet />;
}
