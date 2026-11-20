import type { Metadata } from "next";
import { ParentReport } from "@/practice/ParentReport";

export const metadata: Metadata = { title: "گزارش پیشرفت · جعبه‌ابزار تیزهوشان" };

export default function ParentReportPage() {
  return <ParentReport />;
}
