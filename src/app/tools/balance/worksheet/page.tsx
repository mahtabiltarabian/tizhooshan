import type { Metadata } from "next";
import { BalanceWorksheet } from "@/tools/12-balance/Worksheet";

export const metadata: Metadata = { title: "کاربرگ ترازو · جعبه‌ابزار تیزهوشان" };

export default function BalanceWorksheetPage() {
  return <BalanceWorksheet />;
}
