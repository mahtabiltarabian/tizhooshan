import type { Metadata } from "next";
import { TransformsTool } from "@/tools/01-transforms/TransformsTool";

export const metadata: Metadata = { title: "تبدیل‌ها · جعبه‌ابزار تیزهوشان" };

export default function TransformsPage() {
  return <TransformsTool />;
}
