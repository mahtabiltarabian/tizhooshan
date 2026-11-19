import type { Metadata } from "next";
import { DigitsTool } from "@/tools/13-digits/DigitsTool";

export const metadata: Metadata = { title: "ارقام · جعبه‌ابزار تیزهوشان" };

export default function DigitsPage() {
  return <DigitsTool />;
}
