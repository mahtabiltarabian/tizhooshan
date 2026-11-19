import type { Metadata } from "next";
import { CodesWorksheet } from "@/tools/18-codes/Worksheet";

export const metadata: Metadata = { title: "کاربرگ کدگذاری · جعبه‌ابزار تیزهوشان" };

export default function CodesWorksheetPage() {
  return <CodesWorksheet />;
}
