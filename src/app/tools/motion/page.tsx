import type { Metadata } from "next";
import { MotionTool } from "@/tools/15-motion/MotionTool";

export const metadata: Metadata = { title: "حرکت و چرخ‌دنده · جعبه‌ابزار تیزهوشان" };

export default function MotionPage() {
  return <MotionTool />;
}
