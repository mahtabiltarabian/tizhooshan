// Tool 8 in practice sessions, without the generator: what the practice
// pages and the parent report need. The adapter (adapter.ts) adds grading.

import type { PracticeInfo } from "@/practice/adapter";

export const CLOCK_PRACTICE: PracticeInfo = {
  tool: "clock",
  id: 8,
  href: "/tools/clock/",
  types: [
    { key: "angle", label: "زاویه عقربه‌ها" },
    { key: "mirror", label: "ساعت در آینه" },
    { key: "elapsed", label: "بعد و قبل" },
    { key: "drift", label: "ساعت جلو و عقب" },
    { key: "weekday", label: "روز هفته" },
    { key: "month", label: "ماه‌های شمسی" },
  ],
  levels: [1, 2, 3],
  tags: {
    right: "درست",
    hourStill: "عقربه ساعت را ثابت روی عدد می‌گیرد",
    reflex: "زاویه بزرگ (بیرونی) را به جای زاویه کوچک می‌گوید",
    same: "ساعت آینه را همان ساعت واقعی می‌گیرد",
    hourOnly: "در آینه فقط ساعت را برمی‌گرداند، نه دقیقه را",
    minuteOnly: "در آینه فقط دقیقه را برمی‌گرداند، نه ساعت را",
    wrongWay: "جهت را برعکس می‌رود (جلو به جای عقب یا برعکس)",
    noCarry: "از ۶۰ دقیقه یک ساعت جلو نمی‌برد",
    oneUnit: "مقدار را فقط یک بار حساب می‌کند، نه برای همه روزها یا ساعت‌ها",
    noRun: "گذشت خود زمان را فراموش می‌کند",
    offByOne: "در شمردن روزها یکی کم یا زیاد می‌شمارد",
    assume30: "همه ماه‌ها را ۳۰ روزه می‌گیرد",
    esfand: "کبیسه بودن سال را در اسفند حساب نمی‌کند",
    other: "جواب دیگری داد",
  },
};
