import type { Metadata } from "next";
import { SequenceWorksheet } from "@/tools/09-sequence/Worksheet";

export const metadata: Metadata = { title: "کاربرگ دنباله · جعبه‌ابزار تیزهوشان" };

export default function SequenceWorksheetPage() {
  return <SequenceWorksheet />;
}
