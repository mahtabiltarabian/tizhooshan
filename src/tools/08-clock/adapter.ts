// Tool 8 in practice sessions: grading and three-step hints (the light
// data, types and tag words, is in practice.ts).
// The response is the number the panel checks: degrees, minutes past 12:00,
// or a weekday (0 = Saturday).

import { clockMistake, hm, isLeapYear, makeClockQuestion, MONTHS, WEEKDAYS, type ClockQuestionType, type Level } from "@/generators/clock";
import type { ToolAdapter } from "@/practice/adapter";
import { fa } from "@/tools/registry";
import { CLOCK_PRACTICE } from "./practice";
import { durationFa, timeFa } from "./Pictures";

const make = (type: string, level: number, seed: number) => makeClockQuestion(type as ClockQuestionType, level as Level, seed);

const NUDGE: Record<ClockQuestionType, string> = {
  angle: "به عقربه کوتاه دقیق نگاه کن: آیا درست روی عدد است؟",
  mirror: "آینه چپ و راست را جابه‌جا می‌کند؛ هر دو عقربه را در ذهنت برگردان.",
  elapsed: "ساعت‌ها و دقیقه‌ها را جدا حساب کن.",
  drift: "ساعتِ جلو بیشتر از وقت واقعی نشان می‌دهد و ساعتِ عقب کمتر.",
  weekday: "هر ۷ روز، باز همان روز هفته است.",
  month: "ماه‌ها همه یک‌اندازه نیستند.",
};

const RULE: Record<ClockQuestionType, string> = {
  angle: "عقربه دقیقه هر دقیقه ۶ درجه می‌رود و عقربه ساعت هر دقیقه نیم درجه (هر ساعت ۳۰ درجه).",
  mirror: "ساعت واقعی = ۱۲:۰۰ منهای ساعتی که در آینه می‌بینی.",
  elapsed: "وقتی دقیقه‌ها از ۶۰ بگذرند، یک ساعت به ساعت‌ها اضافه می‌شود؛ وقتی از صفر کمتر شوند، یک ساعت قرض بگیر.",
  drift: "مقدار جلو یا عقب رفتن را در تعداد روزها یا ساعت‌ها ضرب کن.",
  weekday: "تعداد روزها را بر ۷ تقسیم کن؛ فقط باقی‌مانده مهم است.",
  month: "شش ماه اول ۳۱ روز، پنج ماه بعد ۳۰ روز و اسفند ۲۹ روز (در سال کبیسه ۳۰).",
};

function firstStep(type: string, level: number, seed: number): string {
  const q = make(type, level, seed);
  switch (q.type) {
    case "angle": {
      const { m } = hm(q.time);
      return `گام اول: در ${fa(m)} دقیقه، عقربه دقیقه ${fa(6 * m)} درجه از ۱۲ جلو رفته است.`;
    }
    case "mirror":
      return `گام اول: ۱۲:۰۰ را بنویس و ${timeFa(q.shown)} را از آن کم کن.`;
    case "elapsed":
      return `گام اول: ${durationFa(q.minutes)} را به ساعت و دقیقه جدا کن و اول ساعت‌ها را ${q.back ? "کم" : "اضافه"} کن.`;
    case "drift":
      return q.variant === "offset"
        ? `گام اول: ساعت ${q.fast ? "جلو" : "عقب"} است، پس وقت واقعی ${q.fast ? "کمتر" : "بیشتر"} از ${timeFa(q.start)} است.`
        : `گام اول: در کل ${fa(q.span)} ${q.variant === "perDay" ? "روز" : "ساعت"}، ساعت ${fa(q.span)} × ${fa(q.rate)} دقیقه ${q.fast ? "جلو" : "عقب"} می‌رود.`;
    case "weekday":
      return `گام اول: ${fa(q.days)} روز = ${fa(Math.floor(q.days / 7))} هفته کامل و ${fa(q.days % 7)} روز.`;
    case "month":
      return q.year !== undefined
        ? `گام اول: سال ${fa(q.year)} کبیسه ${isLeapYear(q.year) ? "است" : "نیست"}؛ پس اسفندش ${isLeapYear(q.year) ? "۳۰" : "۲۹"} روز دارد.`
        : `گام اول: ${MONTHS[q.from.m].name} ${fa(MONTHS[q.from.m].days)} روز دارد؛ روزهای باقی‌مانده آن را بشمار. (شروع: ${WEEKDAYS[q.weekday]})`;
  }
}

export const CLOCK_ADAPTER: ToolAdapter = {
  ...CLOCK_PRACTICE,
  version: "clock@1",
  grade: (type, level, seed, response) => (typeof response === "number" ? clockMistake(make(type, level, seed), response) : "other"),
  hints: (type, level, seed) => [NUDGE[type as ClockQuestionType], RULE[type as ClockQuestionType], firstStep(type, level, seed)],
};
