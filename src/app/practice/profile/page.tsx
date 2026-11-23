import type { Metadata } from "next";
import { ChildProfile } from "@/practice/ChildProfile";

export const metadata: Metadata = { title: "پروفایل · جعبه‌ابزار تیزهوشان" };

export default function ChildProfilePage() {
  return <ChildProfile />;
}
