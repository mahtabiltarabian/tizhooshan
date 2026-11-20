import type { Metadata } from "next";
import { PracticeResult } from "@/practice/PracticeResult";

export const metadata: Metadata = { title: "نتیجه تمرین · جعبه‌ابزار تیزهوشان" };

export default function PracticeResultPage() {
  return <PracticeResult />;
}
