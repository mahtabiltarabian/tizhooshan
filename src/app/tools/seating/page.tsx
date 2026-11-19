import type { Metadata } from "next";
import { SeatingTool } from "@/tools/20-seating/SeatingTool";

export const metadata: Metadata = { title: "میز چیدمان و شجره‌نامه · جعبه‌ابزار تیزهوشان" };

export default function SeatingPage() {
  return <SeatingTool />;
}
