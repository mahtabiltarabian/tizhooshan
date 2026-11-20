// Tool 15 in practice sessions, without the generators: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { MotionTag } from "@/generators/motion";
import type { PracticeInfo } from "@/practice/adapter";

/** Every tag of the motion and motion-map generators; the type keeps the list complete. */
const TAGS: Record<MotionTag, string> = {
  right: "درست",
  // Gears and belts
  allSame: "فکر می‌کند همه‌ی چرخ‌ها هم‌جهت می‌چرخند",
  alwaysOpposite: "فکر می‌کند چرخ آخر همیشه برعکس چرخ اول می‌چرخد",
  crossIgnored: "تسمه‌ی ضربدری را که جهت را برعکس می‌کند نادیده می‌گیرد",
  beltFlips: "فکر می‌کند تسمه‌ی ساده هم جهت را برعکس می‌کند",
  inverted: "نسبت اندازه‌ی چرخ‌ها را برعکس به کار می‌برد",
  sameTurns: "فکر می‌کند همه‌ی چرخ‌ها به یک تعداد دور می‌زنند",
  middleOnly: "فقط تا چرخ وسط حساب می‌کند",
  // Trips and chases
  timesInstead: "به جای تقسیم ضرب می‌کند",
  divideInstead: "به جای ضرب تقسیم می‌کند",
  plusInstead: "به جای ضرب جمع می‌کند",
  subtractedSpeeds: "سرعت‌ها را از هم کم می‌کند، در حالی که به طرف هم می‌روند",
  addedSpeeds: "سرعت‌ها را جمع می‌کند، در حالی که هم‌جهت می‌روند",
  oneSpeed: "فقط با سرعت یکی از دو نفر حساب می‌کند",
  half: "فکر می‌کند همیشه وسط راه به هم می‌رسند",
  otherSide: "فاصله را از سر دیگر مسیر می‌گوید",
  noDelay: "دیرتر راه افتادن یکی را نادیده می‌گیرد",
  fromLater: "زمان را از حرکت دومی می‌شمارد، نه از حرکت اولی",
  fromStart: "زمانی را که دیگری زودتر راه افتاد هم اضافه می‌کند",
  gapOnly: "فقط رسیدن را حساب می‌کند، نه جلو افتادن بعدش را",
  leadOnly: "فقط جلو افتادن را حساب می‌کند و فاصله‌ی اول را نه",
  // Directions and grids
  swapped: "راست و چپ را جابه‌جا می‌گیرد",
  aroundSwap: "بعد از عقب‌گرد، راست و چپ را جابه‌جا می‌گیرد",
  threeQuarter: "سه ربع دور را یک ربع دور می‌گیرد",
  fromNorth: "از شمال شروع می‌کند، نه از جهتی که رو به آن ایستاده",
  eastWest: "شرق و غرب را جابه‌جا می‌گیرد",
  northSouth: "شمال و جنوب را جابه‌جا می‌گیرد",
  skipLast: "دستور آخر را جا می‌اندازد",
  noTurns: "چرخش‌ها را نادیده می‌گیرد و فقط جلو می‌رود",
  edgesOnly: "فقط دو راه کناری را می‌شمارد",
  plusRoutes: "تعداد ستون‌ها و ردیف‌ها را جمع می‌کند",
  timesRoutes: "تعداد ستون‌ها و ردیف‌ها را ضرب می‌کند",
  // Spacing
  postsAsGaps: "تعداد چیزها (درخت، تیرک…) را با تعداد فاصله‌ها یکی می‌گیرد",
  minusOne: "یکی کم می‌شمارد",
  loopOpen: "مسیر بسته را مثل یک ردیف باز حساب می‌کند",
  cutsAsPieces: "تعداد برش‌ها را با تعداد تکه‌ها یکی می‌گیرد",
  endsFilled: "در دو سر هم چیزی می‌گذارد، در حالی که دو سر خالی است",
  oneSide: "فقط یک طرف جاده را حساب می‌کند",
  cornersTwice: "گوشه‌ها را دو بار می‌شمارد",
  floorsAsGaps: "تعداد طبقه‌ها را با تعداد راه‌پله‌ها یکی می‌گیرد",
  // Road maps
  fewestRoads: "راهی با کمترین تعداد جاده را می‌گیرد، نه کوتاه‌ترین راه را",
  greedy: "هر بار نزدیک‌ترین جاده را انتخاب می‌کند و کل راه را نمی‌سنجد",
  forgotVia: "از شهری که باید سر راه به آن سر بزند نمی‌گذرد",
  forgotReturn: "برگشت به شهر اول را حساب نمی‌کند",
  outAndBack: "بین هر دو شهر به شهر اول برمی‌گردد",
  spurOnce: "جاده‌ای را که باید رفت و برگشت، یک بار می‌شمارد",
  onBest: "جاده‌ای را می‌بندد که روی بهترین راه است",
  cheapestFew: "ارزان‌ترین جاده‌ها را برمی‌دارد، حتی اگر دور بسازند",
  allRoads: "همه‌ی جاده‌ها را حساب می‌کند",
  other: "جواب دیگری داد",
};

export const MOTION_PRACTICE: PracticeInfo = {
  tool: "motion",
  id: 15,
  href: "/tools/motion/",
  types: [
    { key: "gearDir", label: "جهت چرخش" },
    { key: "gearTurns", label: "تعداد دور" },
    { key: "trip", label: "سفر و به هم رسیدن" },
    { key: "chase", label: "رسیدن و سبقت" },
    { key: "orient", label: "جهت‌یابی" },
    { key: "grid", label: "مسیر در شبکه" },
    { key: "spacing", label: "فاصله‌ها" },
    { key: "map", label: "کوتاه‌ترین مسیر روی نقشه" },
  ],
  levels: [1, 2, 3],
  tags: TAGS,
};
