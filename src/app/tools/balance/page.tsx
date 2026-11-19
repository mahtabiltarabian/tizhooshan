import type { Metadata } from "next";
import { BalanceTool } from "@/tools/12-balance/BalanceTool";

export const metadata: Metadata = { title: "ترازو · جعبه‌ابزار تیزهوشان" };

export default function BalancePage() {
  return <BalanceTool />;
}
