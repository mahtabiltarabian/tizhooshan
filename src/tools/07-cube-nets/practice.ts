// Tool 7 in practice sessions, without the generators: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.
// Net questions and dice questions share one list of types, as in the tool.

import type { PracticeInfo } from "@/practice/adapter";

export const CUBE_NETS_PRACTICE: PracticeInfo = {
  tool: "cube-nets",
  id: 7,
  href: "/tools/cube-nets/",
  types: [
    { key: "opposite", label: "وجه روبرو" },
    { key: "touch", label: "وجه‌های مجاور" },
    { key: "hidden", label: "وجه پنهان" },
    { key: "missing", label: "وجه گمشده" },
    { key: "makes", label: "کدام مکعب" },
    { key: "cannot", label: "کدام مکعب نمی‌شود" },
    { key: "netMakes", label: "کدام گسترده" },
    { key: "netCannot", label: "کدام گسترده نمی‌شود" },
    { key: "place", label: "نمادگذاری" },
    { key: "die", label: "تاس استاندارد" },
    { key: "roll", label: "غلتاندن تاس" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    // Nets
    adjacent: "وجهی را روبرو می‌گیرد که در واقع کنار آن است",
    target: "خود وجه داده‌شده را انتخاب می‌کند",
    withOpposite: "وجه روبرو را هم مجاور می‌گیرد",
    missedSome: "فقط بعضی از وجه‌های مجاور را پیدا می‌کند",
    visible: "جوابی را برمی‌دارد که در تصویر پیداست، پس کنار است نه روبرو",
    turned: "نماد را درست سر جایش می‌گذارد ولی با جهت نادرست",
    oppositeSide: "مکعبی را می‌پذیرد که در آن دو وجه روبرو کنار هم دیده می‌شوند",
    swapped: "جای دو نماد را جابه‌جا می‌بیند",
    possible: "شکلی را نشدنی می‌داند که در واقع درست ساخته می‌شود",
    misplaced: "نمادها را جای نادرست روی گسترده می‌گذارد",
    // The standard die
    sameFace: "عدد همان وجهی را که می‌بیند می‌گوید، نه روبرویش را",
    nextNumber: "عدد بعدی یا قبلی را روبرو می‌گیرد",
    sumSix: "مجموع دو وجه روبرو را ۶ می‌گیرد، نه ۷",
    otherBlank: "عدد خانه خالی دیگر را می‌گذارد",
    shown: "عددی را می‌گذارد که روی گسترده هست",
    notStandard: "گسترده‌ای را برمی‌دارد که در آن دو وجه روبرو جمعشان ۷ نیست",
    // Rolling a die
    noRoll: "عدد وجه را پیش از غلتیدن می‌گوید",
    wrongWay: "تاس را برعکس می‌غلتاند",
    mirror: "غلت‌های راست و چپ را برعکس می‌زند",
    flipNS: "غلت‌های عقب و جلو را برعکس می‌زند",
    topBottom: "وجه بالا و زیر را جابه‌جا می‌گیرد",
    frontBack: "وجه روبرو و پشت را جابه‌جا می‌گیرد",
    oneShort: "یک غلت را جا می‌اندازد",
    other: "جواب دیگری داد",
  },
};
