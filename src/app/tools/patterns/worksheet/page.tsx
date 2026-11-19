import type { Metadata } from "next";
import { PatternsWorksheet } from "@/tools/03-patterns/Worksheet";

export const metadata: Metadata = { title: "کاربرگ موتور الگو و ماتریس · جعبه‌ابزار تیزهوشان" };

export default function PatternsWorksheetPage() {
  return <PatternsWorksheet />;
}
