import type { Metadata } from "next";
import { TeacherPanel } from "@/practice/TeacherPanel";

export const metadata: Metadata = { title: "پنل معلم · جعبه‌ابزار تیزهوشان" };

export default function PanelPage() {
  return <TeacherPanel />;
}
