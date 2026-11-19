import type { Metadata } from "next";
import { ClockTool } from "@/tools/08-clock/ClockTool";

export const metadata: Metadata = { title: "ساعت و تقویم · جعبه‌ابزار تیزهوشان" };

export default function ClockPage() {
  return <ClockTool />;
}
