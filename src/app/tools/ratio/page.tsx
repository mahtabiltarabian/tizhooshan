import type { Metadata } from "next";
import { RatioTool } from "@/tools/14-ratio/RatioTool";

export const metadata: Metadata = { title: "نسبت · جعبه‌ابزار تیزهوشان" };

export default function RatioPage() {
  return <RatioTool />;
}
