import type { Metadata } from "next";
import { LogicWorksheet } from "@/tools/19-logic/Worksheet";

export const metadata: Metadata = { title: "کاربرگ تخته استدلال · جعبه‌ابزار تیزهوشان" };

export default function LogicWorksheetPage() {
  return <LogicWorksheet />;
}
