import type { Metadata } from "next";
import { CubeNetsTool } from "@/tools/07-cube-nets/CubeNetsTool";

export const metadata: Metadata = { title: "گسترده و تاس · جعبه‌ابزار تیزهوشان" };

export default function CubeNetsPage() {
  return <CubeNetsTool />;
}
