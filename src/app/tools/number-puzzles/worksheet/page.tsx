import type { Metadata } from "next";
import { NumberPuzzlesWorksheet } from "@/tools/10-number-puzzles/Worksheet";

export const metadata: Metadata = { title: "کاربرگ معماهای عدد · جعبه‌ابزار تیزهوشان" };

export default function NumberPuzzlesWorksheetPage() {
  return <NumberPuzzlesWorksheet />;
}
