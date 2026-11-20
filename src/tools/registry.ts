// The 20 tools from the tools map (docs/tizhooshan-tools-map.md), and tool
// 21 from phase 2 (docs/phase2-plan.md). `href` is set only for built tools.

export type Area = "visual" | "computational" | "logical" | "speed";

export interface ToolInfo {
  id: number;
  title: string;
  area: Area;
  /** Build wave of phase 1; 4 = phase 2. */
  wave: 1 | 2 | 3 | 4;
  href?: string;
}

export const AREA_LABEL: Record<Area, string> = {
  visual: "تصویری",
  computational: "محاسباتی",
  logical: "منطقی",
  speed: "سرعتی",
};

export const TOOLS: ToolInfo[] = [
  { id: 1, title: "تبدیل‌ها", area: "visual", wave: 1, href: "/tools/transforms" },
  { id: 2, title: "کاغذ", area: "visual", wave: 1, href: "/tools/paper" },
  { id: 3, title: "موتور الگو و ماتریس", area: "visual", wave: 1, href: "/tools/patterns" },
  { id: 4, title: "هم‌پوشانی و پازل", area: "visual", wave: 2, href: "/tools/puzzle" },
  { id: 5, title: "شمارشگر شکل", area: "visual", wave: 1, href: "/tools/shape-counter" },
  { id: 6, title: "برج مکعب‌ها", area: "visual", wave: 1, href: "/tools/cube-towers" },
  { id: 7, title: "گسترده و تاس", area: "visual", wave: 1, href: "/tools/cube-nets" },
  { id: 8, title: "ساعت و تقویم", area: "computational", wave: 2, href: "/tools/clock" },
  { id: 9, title: "دنباله", area: "computational", wave: 2, href: "/tools/sequence" },
  { id: 10, title: "معماهای عدد", area: "computational", wave: 2, href: "/tools/number-puzzles" },
  { id: 11, title: "ماشین اعداد", area: "computational", wave: 2, href: "/tools/number-machine" },
  { id: 12, title: "ترازو", area: "computational", wave: 2, href: "/tools/balance" },
  { id: 13, title: "ارقام", area: "computational", wave: 2, href: "/tools/digits" },
  { id: 14, title: "نسبت", area: "computational", wave: 2, href: "/tools/ratio" },
  { id: 15, title: "حرکت و چرخ‌دنده", area: "computational", wave: 3, href: "/tools/motion" },
  { id: 16, title: "هندسه", area: "computational", wave: 3, href: "/tools/geometry" },
  { id: 17, title: "چیدمان و شمارش", area: "logical", wave: 3, href: "/tools/counting" },
  { id: 18, title: "کدگذاری", area: "logical", wave: 3, href: "/tools/codes" },
  { id: 19, title: "تخته استدلال", area: "logical", wave: 3, href: "/tools/logic" },
  { id: 20, title: "میز چیدمان و شجره‌نامه", area: "logical", wave: 3, href: "/tools/seating" },
  { id: 21, title: "سرعت و دقت", area: "speed", wave: 4, href: "/tools/speed" },
];

/** Western digits to Persian digits. */
export const fa = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
