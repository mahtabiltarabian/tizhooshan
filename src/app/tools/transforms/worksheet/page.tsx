import type { Metadata } from "next";
import { TransformsWorksheet } from "@/tools/01-transforms/Worksheet";

export const metadata: Metadata = { title: "کاربرگ تبدیل‌ها · جعبه‌ابزار تیزهوشان" };

export default function TransformsWorksheetPage() {
  return <TransformsWorksheet />;
}
