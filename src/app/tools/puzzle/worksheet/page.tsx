import type { Metadata } from "next";
import { PuzzleWorksheet } from "@/tools/04-puzzle/Worksheet";

export const metadata: Metadata = { title: "کاربرگ هم‌پوشانی و پازل · جعبه‌ابزار تیزهوشان" };

export default function PuzzleWorksheetPage() {
  return <PuzzleWorksheet />;
}
