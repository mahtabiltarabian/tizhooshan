import type { Metadata } from "next";
import { PuzzleTool } from "@/tools/04-puzzle/PuzzleTool";

export const metadata: Metadata = { title: "هم‌پوشانی و پازل · جعبه‌ابزار تیزهوشان" };

export default function PuzzlePage() {
  return <PuzzleTool />;
}
