import type { Metadata } from "next";
import { CodesTool } from "@/tools/18-codes/CodesTool";

export const metadata: Metadata = { title: "کدگذاری · جعبه‌ابزار تیزهوشان" };

export default function CodesPage() {
  return <CodesTool />;
}
