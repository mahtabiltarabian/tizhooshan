import type { Metadata } from "next";
import { GeometryWorksheet } from "@/tools/16-geometry/Worksheet";

export const metadata: Metadata = { title: "کاربرگ هندسه · جعبه‌ابزار تیزهوشان" };

export default function GeometryWorksheetPage() {
  return <GeometryWorksheet />;
}
