import type { Metadata } from "next";
import { GeometryTool } from "@/tools/16-geometry/GeometryTool";

export const metadata: Metadata = { title: "هندسه · جعبه‌ابزار تیزهوشان" };

export default function GeometryPage() {
  return <GeometryTool />;
}
