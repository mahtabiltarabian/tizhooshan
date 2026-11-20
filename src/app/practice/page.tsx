import type { Metadata } from "next";
import { PracticeHome } from "@/practice/PracticeHome";

export const metadata: Metadata = { title: "تمرین · جعبه‌ابزار تیزهوشان" };

export default function PracticePage() {
  return <PracticeHome />;
}
