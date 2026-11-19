import type { Metadata } from "next";
import { MachineWorksheet } from "@/tools/11-number-machine/Worksheet";

export const metadata: Metadata = { title: "کاربرگ ماشین اعداد · جعبه‌ابزار تیزهوشان" };

export default function NumberMachineWorksheetPage() {
  return <MachineWorksheet />;
}
