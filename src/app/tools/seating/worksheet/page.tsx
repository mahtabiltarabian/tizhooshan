import type { Metadata } from "next";
import { SeatingWorksheet } from "@/tools/20-seating/Worksheet";

export const metadata: Metadata = { title: "کاربرگ میز چیدمان و شجره‌نامه · جعبه‌ابزار تیزهوشان" };

export default function SeatingWorksheetPage() {
  return <SeatingWorksheet />;
}
