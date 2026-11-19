import type { Metadata } from "next";
import { CubeTowersTool } from "@/tools/06-cube-towers/CubeTowersTool";

export const metadata: Metadata = { title: "برج مکعب‌ها · جعبه‌ابزار تیزهوشان" };

export default function CubeTowersPage() {
  return <CubeTowersTool />;
}
