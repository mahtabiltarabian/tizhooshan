import type { Metadata } from "next";
import { PaperTool } from "@/tools/02-paper/PaperTool";

export const metadata: Metadata = { title: "کاغذ · جعبه‌ابزار تیزهوشان" };

export default function PaperPage() {
  return <PaperTool />;
}
