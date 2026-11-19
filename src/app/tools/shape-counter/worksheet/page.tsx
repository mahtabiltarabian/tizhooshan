import type { Metadata } from "next";
import { ShapeCounterWorksheet } from "@/tools/05-shape-counter/Worksheet";

export const metadata: Metadata = { title: "کاربرگ شمارشگر شکل · جعبه‌ابزار تیزهوشان" };

export default function ShapeCounterWorksheetPage() {
  return <ShapeCounterWorksheet />;
}
