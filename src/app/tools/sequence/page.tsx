import type { Metadata } from "next";
import { SequenceTool } from "@/tools/09-sequence/SequenceTool";

export const metadata: Metadata = { title: "دنباله · جعبه‌ابزار تیزهوشان" };

export default function SequencePage() {
  return <SequenceTool />;
}
