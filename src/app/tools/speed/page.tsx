import type { Metadata } from "next";
import { SpeedTool } from "@/tools/21-speed/SpeedTool";

export const metadata: Metadata = { title: "سرعت و دقت · جعبه‌ابزار تیزهوشان" };

export default function SpeedPage() {
  return <SpeedTool />;
}
