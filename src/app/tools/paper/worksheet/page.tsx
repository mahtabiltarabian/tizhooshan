import type { Metadata } from "next";
import { PaperWorksheet } from "@/tools/02-paper/Worksheet";

export const metadata: Metadata = { title: "کاربرگ کاغذ · جعبه‌ابزار تیزهوشان" };

export default function PaperWorksheetPage() {
  return <PaperWorksheet />;
}
