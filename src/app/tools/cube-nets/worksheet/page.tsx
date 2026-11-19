import type { Metadata } from "next";
import { Worksheet } from "@/tools/07-cube-nets/Worksheet";

export const metadata: Metadata = { title: "کاربرگ گسترده و تاس · جعبه‌ابزار تیزهوشان" };

export default function WorksheetPage() {
  return <Worksheet />;
}
