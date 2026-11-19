import type { Metadata } from "next";
import { PatternsTool } from "@/tools/03-patterns/PatternsTool";

export const metadata: Metadata = { title: "موتور الگو و ماتریس · جعبه‌ابزار تیزهوشان" };

export default function PatternsPage() {
  return <PatternsTool />;
}
