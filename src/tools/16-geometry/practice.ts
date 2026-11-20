// Tool 16 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { BuildTag, CutTag, GeometryTag } from "@/generators/geometry";
import type { PracticeInfo } from "@/practice/adapter";

// One word list for the number slips, the built shapes and the cuts; a key
// shared by two of them ("few", "noHalf") means the same slip in both.
const TAGS = {
  right: "درست",
  // area and perimeter on the geoboard
  perimeter: "محیط را به جای مساحت حساب می‌کند",
  halfAsWhole: "نیم‌مربع‌ها را مربع کامل می‌شمارد",
  noHalves: "نیم‌مربع‌ها را نمی‌شمارد",
  noHalf: "یک «÷ ۲» لازم را جا می‌اندازد (مثلاً در مساحت مثلث)",
  box: "اندازه مستطیل دور شکل را می‌گوید، نه خود شکل را",
  dots: "میخ‌ها را می‌شمارد، نه مربع‌ها یا فاصله‌های بین میخ‌ها را",
  area: "مساحت را به جای محیط حساب می‌کند",
  cells: "برای محیط، مربع‌های کنار لبه را می‌شمارد، نه ضلع‌ها را",
  halfP: "فقط نیمی از دور شکل را می‌شمارد",
  // angles
  supplement: "زاویه کنار آن روی خط صاف را می‌گوید",
  reflex: "زاویه بزرگ بیرونی را به جای زاویه بین دو بازو می‌گوید",
  sum360: "جمع زاویه‌های شکل را اشتباه می‌گیرد (مثلاً مثلث را ۳۶۰ درجه)",
  noSubtract: "زاویه‌های معلوم را جمع می‌کند ولی از ۱۸۰ کم نمی‌کند",
  interior: "زاویه داخلی را به جای زاویه بیرونی می‌گوید",
  nTimes180: "جمع زاویه‌های چندضلعی را «تعداد ضلع × ۱۸۰» می‌گیرد",
  total: "جمع همه زاویه‌ها را به جای یک زاویه می‌گوید",
  exterior: "زاویه بیرونی را به جای زاویه داخلی می‌گوید",
  // kind of angle
  slantRight: "زاویه قائمه کج را قائمه نمی‌شناسد",
  nearRight: "زاویه نزدیک به قائمه را قائمه می‌گیرد",
  smallAngle: "نوع مثلث را از یک زاویه تند می‌گوید، نه از بزرگ‌ترین زاویه",
  swap: "تند و باز را جابه‌جا می‌گیرد",
  // circles and composite areas
  dAsR: "قطر را به جای شعاع می‌گذارد",
  rAsD: "شعاع را به جای قطر می‌گذارد",
  squaredD: "در مساحت دایره، قطر را در خودش ضرب می‌کند",
  circForArea: "فرمول محیط دایره را برای مساحت به کار می‌برد",
  areaForCirc: "فرمول مساحت دایره را برای محیط به کار می‌برد",
  noStraight: "لبه‌های صاف را در محیط نیم یا ربع دایره حساب نمی‌کند",
  oneRadius: "یکی از لبه‌های صاف (شعاع یا قطر) را درست حساب نمی‌کند",
  wholeCircle: "برای نیم یا ربع دایره، اندازه دایره کامل را می‌گوید",
  wrongFraction: "ربع دایره را با نیم‌دایره اشتباه می‌گیرد",
  rForD: "شعاع را می‌گوید وقتی قطر خواسته شده",
  dForR: "قطر را می‌گوید وقتی شعاع خواسته شده",
  forgotPi: "از محیط به قطر می‌رود ولی بر ۳٫۱۴ تقسیم نمی‌کند",
  subtractRadii: "اول شعاع‌ها را از هم کم می‌کند، نه مساحت‌ها را",
  added: "جمع می‌کند جایی که باید کم کند",
  bigOnly: "قسمت سفید یا سوراخ را کم نمی‌کند",
  holeOnly: "مساحت قسمت سفید را به جای قسمت رنگی می‌گوید",
  overlapTwice: "گوشه مشترک دو تکه را دو بار می‌شمارد",
  missingLength: "طول ضلع بی‌عدد را اشتباه پیدا می‌کند",
  noCut: "گوشه خالی را از مستطیل دور کم نمی‌کند",
  wrongSign: "تکه‌ای را که باید اضافه کند کم می‌کند",
  // parallel lines
  equalNotSupp: "دو زاویه را برابر می‌گیرد، ولی با هم ۱۸۰ درجه می‌شوند",
  suppNotEqual: "دو زاویه برابر را با هم ۱۸۰ درجه می‌گیرد",
  notParallel: "زاویه را به خطی منتقل می‌کند که موازی نیست",
  subtracted: "تکه‌های یک زاویه را از هم کم می‌کند به جای جمع",
  asTriangle: "جایی که مثلثی نیست، جمع زاویه‌های مثلث را به کار می‌برد",
  insideBend: "زاویه داخل خم را به جای زاویه بیرون آن می‌گوید",
  pointAs180: "جمع زاویه‌های دور یک نقطه را ۱۸۰ درجه می‌گیرد",
  // building a shape, cutting it in two
  few: "شکل یا کش را کامل نمی‌کند (میخ‌های کافی لمس نمی‌کند)",
  crossing: "کش را از روی خودش رد می‌کند و شکل درستی نمی‌سازد",
  notRect: "شکلی که می‌سازد مستطیل نیست",
  notTri: "شکلی که می‌سازد مثلث نیست",
  notSquare: "شکلی که می‌سازد مربع نیست",
  notSlanted: "مربع صاف می‌سازد، نه مربع کج",
  notGrid: "ضلع کج می‌گذارد، ولی ضلع‌ها باید روی خطوط شبکه باشند",
  isRect: "مستطیل می‌سازد، ولی شکل دیگری خواسته شده",
  confused: "مساحت و محیط را جابه‌جا می‌گیرد",
  areaOnly: "مساحت را درست می‌سازد ولی محیط را نه",
  perimOnly: "محیط را درست می‌سازد ولی مساحت را نه",
  wrongValue: "شکل درستی می‌سازد ولی با اندازه نادرست",
  notEdge: "سر کش را روی لبه شکل نمی‌گذارد",
  alongEdge: "کش را روی لبه شکل می‌گذارد، نه از درون آن",
  unequal: "شکل را به دو قسمت نابرابر تقسیم می‌کند",
  other: "جواب دیگری داد",
} satisfies Record<GeometryTag | BuildTag | CutTag, string>;

export const GEOMETRY_PRACTICE: PracticeInfo = {
  tool: "geometry",
  id: 16,
  href: "/tools/geometry/",
  types: [
    { key: "area", label: "مساحت" },
    { key: "perimeter", label: "محیط" },
    { key: "angle", label: "اندازه زاویه" },
    { key: "classify", label: "نوع زاویه" },
    { key: "build", label: "ساختن شکل" },
    { key: "divide", label: "دو نیمه کردن" },
    { key: "circle", label: "دایره" },
    { key: "composite", label: "مساحت ترکیبی" },
    { key: "parallel", label: "خطوط موازی و زاویه" },
  ],
  levels: [1, 2, 3],
  tags: TAGS,
};
