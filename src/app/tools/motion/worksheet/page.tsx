import type { Metadata } from "next";
import { MotionWorksheet } from "@/tools/15-motion/Worksheet";

export const metadata: Metadata = { title: "کاربرگ حرکت و چرخ‌دنده · جعبه‌ابزار تیزهوشان" };

export default function MotionWorksheetPage() {
  return <MotionWorksheet />;
}
