import type { Metadata } from "next";
import { LogicTool } from "@/tools/19-logic/LogicTool";

export const metadata: Metadata = { title: "تخته استدلال · جعبه‌ابزار تیزهوشان" };

export default function LogicPage() {
  return <LogicTool />;
}
