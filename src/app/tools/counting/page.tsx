import type { Metadata } from "next";
import { CountingTool } from "@/tools/17-counting/CountingTool";

export const metadata: Metadata = { title: "چیدمان و شمارش · جعبه‌ابزار تیزهوشان" };

export default function CountingPage() {
  return <CountingTool />;
}
