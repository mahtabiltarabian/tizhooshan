import type { Metadata } from "next";
import { TowerWorksheet } from "@/tools/06-cube-towers/Worksheet";

export const metadata: Metadata = { title: "کاربرگ برج مکعب‌ها · جعبه‌ابزار تیزهوشان" };

export default function TowerWorksheetPage() {
  return <TowerWorksheet />;
}
