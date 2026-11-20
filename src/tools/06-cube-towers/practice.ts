// Tool 6 in practice sessions, without the generators: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const CUBE_TOWERS_PRACTICE: PracticeInfo = {
  tool: "cube-towers",
  id: 6,
  href: "/tools/cube-towers/",
  types: [
    { key: "count", label: "شمارش" },
    { key: "top", label: "نمای بالا" },
    { key: "front", label: "نمای روبرو" },
    { key: "side", label: "نمای کنار" },
    { key: "build", label: "ساخت از نما" },
    { key: "complete", label: "تکمیل مکعب" },
    { key: "paint", label: "رنگ کن و ببر" },
    { key: "solid", label: "وجه، یال و رأس" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    // Counting cubes
    visibleOnly: "فقط آنچه را در تصویر دیده می‌شود می‌شمارد، نه مکعب‌ها یا یال‌های پنهان را",
    offByOne: "در شمردن چند تا کم یا زیاد می‌شمارد",
    counted: "مکعب‌های موجود را می‌شمارد، نه آن‌هایی را که کم است",
    otherK: "تعداد مکعب‌های کوچک با تعداد دیگری از وجه‌های رنگی را می‌گوید",
    // Views
    mirrored: "نما را برعکس می‌بیند، انگار از طرف مقابل نگاه کرده",
    otherView: "نمای روبرو و کنار را با هم اشتباه می‌گیرد",
    changed: "نمایی را برمی‌دارد که یک خانه‌اش فرق دارد",
    notMatching: "برجی می‌سازد که با همه نماهای داده‌شده جور نیست",
    // Faces, edges and vertices
    hiddenTwice: "بعضی یال‌های پنهان را دو بار می‌شمارد",
    noBases: "قاعده‌های منشور را نمی‌شمارد",
    oneBase: "یکی از دو قاعده منشور را جا می‌اندازد",
    noBase: "قاعده هرم را نمی‌شمارد",
    noVertical: "یال‌های کناری منشور را نمی‌شمارد",
    baseSides: "فقط ضلع‌های قاعده را می‌شمارد",
    baseOnly: "فقط رأس‌های یک قاعده را می‌شمارد",
    noApex: "سر هرم را به‌عنوان رأس نمی‌شمارد",
    asFaces: "تعداد وجه‌ها را به‌جای چیز خواسته‌شده می‌گوید",
    asEdges: "تعداد یال‌ها را به‌جای چیز خواسته‌شده می‌گوید",
    asVertices: "تعداد رأس‌ها را به‌جای چیز خواسته‌شده می‌گوید",
    added: "به‌جای «چند تا بیشتر»، دو عدد را جمع می‌کند",
    wrongFamily: "قاعده منشور و هرم را جابه‌جا به کار می‌برد",
    nIsGiven: "عدد داده‌شده را تعداد ضلع‌های قاعده می‌گیرد",
    wrongDivide: "یال‌ها را بر عدد اشتباه تقسیم می‌کند (منشور ۳، هرم ۲)",
    justN: "تعداد ضلع‌های قاعده را می‌گوید و یک قدم را جا می‌اندازد",
    euler0: "رابطه رأس − یال + وجه را برابر صفر می‌گیرد، نه ۲",
    eulerSign: "در رابطه رأس − یال + وجه = ۲، علامت ۲ را برعکس می‌گیرد",
    other: "جواب دیگری داد",
  },
};
