import type { Metadata } from "next";
import { MachineTool } from "@/tools/11-number-machine/MachineTool";

export const metadata: Metadata = { title: "ماشین اعداد · جعبه‌ابزار تیزهوشان" };

export default function NumberMachinePage() {
  return <MachineTool />;
}
