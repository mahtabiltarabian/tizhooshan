import type { Metadata } from "next";
import { NumberPuzzlesTool } from "@/tools/10-number-puzzles/NumberPuzzlesTool";

export const metadata: Metadata = { title: "معماهای عدد · جعبه‌ابزار تیزهوشان" };

export default function NumberPuzzlesPage() {
  return <NumberPuzzlesTool />;
}
