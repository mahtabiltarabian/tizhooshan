import type { Metadata } from "next";
import { ShapeCounterTool } from "@/tools/05-shape-counter/ShapeCounterTool";

export const metadata: Metadata = { title: "شمارشگر شکل · جعبه‌ابزار تیزهوشان" };

export default function ShapeCounterPage() {
  return <ShapeCounterTool />;
}
