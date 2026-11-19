// Tool 8: clock and calendar. Times are minutes past 12:00 on a 12-hour dial
// (0 … 719); days of the week count from Saturday (0) like the Persian week.
// Each question keeps its answer and the usual slips, so the feedback can say
// which slip a wrong answer was.

import { mulberry32, pick, randInt, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type ClockQuestionType = "angle" | "mirror" | "elapsed" | "drift" | "weekday" | "month";

export const DIAL = 720;
export const wrap = (t: number) => ((Math.round(t) % DIAL) + DIAL) % DIAL;
export const wrap7 = (d: number) => ((d % 7) + 7) % 7;

/** Hand directions in degrees clockwise from 12. Works for fractional minutes too. */
export function handAngles(t: number) {
  const m = ((t % DIAL) + DIAL) % DIAL;
  return { hour: m / 2, minute: (m % 60) * 6 };
}

/** The smaller angle between the hands, 0 … 180. */
export function angleBetween(t: number) {
  const { hour, minute } = handAngles(t);
  const d = Math.abs(hour - minute);
  return Math.min(d, 360 - d);
}

/** What a clock reads in a mirror beside it (left and right swapped). */
export const mirrorOf = (t: number) => wrap(DIAL - t);

/** Hour 1 … 12 and minute. */
export function hm(t: number) {
  const w = wrap(t);
  return { h: Math.floor(w / 60) || 12, m: w % 60 };
}

export const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** Months of the Persian year: six of 31 days, five of 30, Esfand 29 (30 in a leap year). */
export const MONTHS: { name: string; days: number }[] = [
  { name: "فروردین", days: 31 },
  { name: "اردیبهشت", days: 31 },
  { name: "خرداد", days: 31 },
  { name: "تیر", days: 31 },
  { name: "مرداد", days: 31 },
  { name: "شهریور", days: 31 },
  { name: "مهر", days: 30 },
  { name: "آبان", days: 30 },
  { name: "آذر", days: 30 },
  { name: "دی", days: 30 },
  { name: "بهمن", days: 30 },
  { name: "اسفند", days: 29 },
];

/** Day of the year, 0 … 364, of day d (1 …) of month m (0 …). */
export const dayOfYear = (m: number, d: number) => MONTHS.slice(0, m).reduce((s, x) => s + x.days, 0) + d - 1;

/** Month and day of a day of the year (wraps into the next year). */
export function dateOf(doy: number) {
  let r = ((doy % 365) + 365) % 365;
  for (let m = 0; m < 12; m++) {
    if (r < MONTHS[m].days) return { m, d: r + 1 };
    r -= MONTHS[m].days;
  }
  return { m: 11, d: 29 };
}

export interface DateRef {
  m: number;
  d: number;
}

interface Base {
  level: Level;
  seed: number;
}

export interface AngleQuestion extends Base {
  type: "angle";
  time: number;
  answer: number;
}

export interface MirrorQuestion extends Base {
  type: "mirror";
  /** What the clock in the mirror reads. */
  shown: number;
  answer: number;
}

export interface ElapsedQuestion extends Base {
  type: "elapsed";
  start: number;
  /** How long, in minutes (may be more than 12 hours). */
  minutes: number;
  back: boolean;
  answer: number;
}

/**
 * offset: the clock is `rate` minutes fast or slow and shows `start`; what is the real time?
 * perDay: set right at `start`; after `span` days, gaining or losing `rate` a day, what does it show at `start`?
 * perHour: set right at `start`; `span` hours later, gaining or losing `rate` an hour, what does it show?
 */
export interface DriftQuestion extends Base {
  type: "drift";
  variant: "offset" | "perDay" | "perHour";
  fast: boolean;
  rate: number;
  span: number;
  start: number;
  answer: number;
}

export interface WeekdayQuestion extends Base {
  type: "weekday";
  start: number;
  days: number;
  back: boolean;
  answer: number;
}

export interface MonthQuestion extends Base {
  type: "month";
  from: DateRef;
  to: DateRef;
  /** Weekday of `from`. */
  weekday: number;
  /** Days from `from` to `to`. */
  days: number;
  answer: number;
}

export type ClockQuestion = AngleQuestion | MirrorQuestion | ElapsedQuestion | DriftQuestion | WeekdayQuestion | MonthQuestion;
export type TimeQuestion = MirrorQuestion | ElapsedQuestion | DriftQuestion;
export type DayQuestion = WeekdayQuestion | MonthQuestion;

/** What kind of answer a question wants. */
export const answerKind = (type: ClockQuestionType): "number" | "time" | "day" =>
  type === "angle" ? "number" : type === "weekday" || type === "month" ? "day" : "time";

/** Minutes past the hour for each level: full and half hours; then multiples of 5 (10 for angles); then any. */
function minuteFor(rng: Rng, level: Level, even = false) {
  if (level === 1) return pick(rng, [0, 30]);
  if (level === 2) return even ? pick(rng, [10, 20, 40, 50]) : 5 * randInt(rng, 12);
  // Angles stay whole when the minute is even.
  return even ? 2 * randInt(rng, 30) : randInt(rng, 60);
}

function angleQuestion(rng: Rng, level: Level, seed: number): AngleQuestion {
  for (;;) {
    const time = 60 * randInt(rng, 12) + minuteFor(rng, level, true);
    const answer = angleBetween(time);
    // 12:00 and 6:00 are too plain past level 1.
    if (answer === 0 || (level > 1 && answer === 180)) continue;
    return { type: "angle", level, seed, time, answer };
  }
}

function mirrorQuestion(rng: Rng, level: Level, seed: number): MirrorQuestion {
  for (;;) {
    const shown = 60 * randInt(rng, 12) + minuteFor(rng, level);
    const answer = mirrorOf(shown);
    if (answer === shown) continue;
    // Past level 1, keep the minutes off the hour so the minute hand matters.
    if (level > 1 && shown % 30 === 0) continue;
    return { type: "mirror", level, seed, shown, answer };
  }
}

function elapsedQuestion(rng: Rng, level: Level, seed: number): ElapsedQuestion {
  const start = 60 * randInt(rng, 12) + minuteFor(rng, level);
  let minutes: number;
  let back = false;
  if (level === 1) minutes = 60 * (1 + randInt(rng, 5)) + pick(rng, [0, 30]);
  else if (level === 2) {
    back = rng() < 0.4;
    // Make the minutes cross the hour, so carrying (or borrowing) matters.
    const sm = start % 60;
    const choices = Array.from({ length: 11 }, (_, i) => 5 * (i + 1)).filter((m) => (back ? m > sm : sm + m >= 60));
    minutes = 60 * (1 + randInt(rng, 3)) + (choices.length ? pick(rng, choices) : 35);
  } else {
    back = rng() < 0.4;
    minutes = rng() < 0.4 ? 60 * (13 + randInt(rng, 11)) + 5 * randInt(rng, 12) : 60 * (1 + randInt(rng, 4)) + 1 + randInt(rng, 59);
  }
  return { type: "elapsed", level, seed, start, minutes, back, answer: wrap(start + (back ? -minutes : minutes)) };
}

function driftQuestion(rng: Rng, level: Level, seed: number): DriftQuestion {
  const fast = rng() < 0.5;
  if (level === 1) {
    const rate = pick(rng, [5, 10, 15, 20]);
    const start = 60 * randInt(rng, 12) + 5 * randInt(rng, 12);
    return { type: "drift", level, seed, variant: "offset", fast, rate, span: 0, start, answer: wrap(start + (fast ? -rate : rate)) };
  }
  if (level === 2) {
    const rate = pick(rng, [2, 3, 4, 5, 6]);
    const span = 3 + randInt(rng, 8);
    const start = 60 * randInt(rng, 12);
    return { type: "drift", level, seed, variant: "perDay", fast, rate, span, start, answer: wrap(start + (fast ? 1 : -1) * rate * span) };
  }
  const rate = pick(rng, [1, 2, 3, 4]);
  const span = 3 + randInt(rng, 7);
  const start = 60 * randInt(rng, 12) + pick(rng, [0, 30]);
  return { type: "drift", level, seed, variant: "perHour", fast, rate, span, start, answer: wrap(start + 60 * span + (fast ? 1 : -1) * rate * span) };
}

function weekdayQuestion(rng: Rng, level: Level, seed: number): WeekdayQuestion {
  const start = randInt(rng, 7);
  const [days, back] =
    level === 1 ? [2 + randInt(rng, 12), false] : level === 2 ? [15 + randInt(rng, 56), rng() < 0.4] : [100 + randInt(rng, 301), rng() < 0.4];
  if (level === 1 && days % 7 === 0) return weekdayQuestion(rng, level, seed);
  return { type: "weekday", level, seed, start, days, back, answer: wrap7(start + (back ? -days : days)) };
}

function monthQuestion(rng: Rng, level: Level, seed: number): MonthQuestion {
  const weekday = randInt(rng, 7);
  let from: DateRef;
  let to: DateRef;
  if (level === 1) {
    const m = randInt(rng, 12);
    const d1 = 1 + randInt(rng, 8);
    from = { m, d: d1 };
    to = { m, d: d1 + 3 + randInt(rng, Math.min(MONTHS[m].days - d1 - 2, 20)) };
  } else if (level === 2) {
    // Into the next month; the length of this month matters.
    const m = randInt(rng, 11);
    from = { m, d: 5 + randInt(rng, 24) };
    to = { m: m + 1, d: 1 + randInt(rng, 28) };
  } else {
    const m = randInt(rng, 9);
    from = { m, d: 1 + randInt(rng, 28) };
    to = { m: m + 2 + randInt(rng, Math.min(3, 11 - m - 1)), d: 1 + randInt(rng, 29) };
  }
  const days = dayOfYear(to.m, to.d) - dayOfYear(from.m, from.d);
  return { type: "month", level, seed, from, to, weekday, days, answer: wrap7(weekday + days) };
}

export function makeClockQuestion(type: ClockQuestionType, level: Level, seed: number): ClockQuestion {
  const rng = mulberry32(seed * 7 + level * 101 + type.length * 13);
  switch (type) {
    case "angle":
      return angleQuestion(rng, level, seed);
    case "mirror":
      return mirrorQuestion(rng, level, seed);
    case "elapsed":
      return elapsedQuestion(rng, level, seed);
    case "drift":
      return driftQuestion(rng, level, seed);
    case "weekday":
      return weekdayQuestion(rng, level, seed);
    case "month":
      return monthQuestion(rng, level, seed);
  }
}

export type ClockTag =
  | "right"
  | "hourStill"
  | "reflex"
  | "same"
  | "hourOnly"
  | "minuteOnly"
  | "wrongWay"
  | "noCarry"
  | "oneUnit"
  | "noRun"
  | "offByOne"
  | "assume30"
  | "other";

/** Wrong answers with a known cause, in the order they are checked. */
export function slips(q: ClockQuestion): [ClockTag, number][] {
  switch (q.type) {
    case "angle": {
      const { h, m } = hm(q.time);
      const d = Math.abs(30 * (h % 12) - 6 * m) % 360;
      return [
        ["hourStill", Math.min(d, 360 - d)],
        ["reflex", 360 - q.answer],
      ];
    }
    case "mirror": {
      const { h, m } = hm(q.shown);
      return [
        ["same", q.shown],
        ["hourOnly", wrap((12 - (h % 12)) * 60 + m)],
        ["minuteOnly", wrap((h % 12) * 60 + ((60 - m) % 60))],
      ];
    }
    case "elapsed": {
      const sm = q.start % 60;
      const am = q.minutes % 60;
      const carried = q.back ? sm < am : sm + am >= 60;
      return [
        ["wrongWay", wrap(q.start + (q.back ? q.minutes : -q.minutes))],
        ...(carried ? [["noCarry", wrap(q.answer + (q.back ? 60 : -60))] as [ClockTag, number]] : []),
      ];
    }
    case "drift": {
      const s = q.fast ? 1 : -1;
      if (q.variant === "offset") return [["wrongWay", wrap(q.start + s * q.rate)]];
      if (q.variant === "perDay")
        return [
          ["wrongWay", wrap(q.start - s * q.rate * q.span)],
          ["oneUnit", wrap(q.start + s * q.rate)],
        ];
      return [
        ["wrongWay", wrap(q.start + 60 * q.span - s * q.rate * q.span)],
        ["oneUnit", wrap(q.start + 60 * q.span + s * q.rate)],
        ["noRun", wrap(q.start + s * q.rate * q.span)],
      ];
    }
    case "weekday": {
      const dir = q.back ? -1 : 1;
      return [
        ["wrongWay", wrap7(q.start - dir * q.days)],
        ["offByOne", wrap7(q.answer - dir)],
        ["offByOne", wrap7(q.answer + dir)],
      ];
    }
    case "month": {
      const days30 = (q.to.m - q.from.m) * 30 + q.to.d - q.from.d;
      return [
        ["assume30", wrap7(q.weekday + days30)],
        ["offByOne", wrap7(q.answer - 1)],
        ["offByOne", wrap7(q.answer + 1)],
      ];
    }
  }
}

const same = (q: ClockQuestion, a: number, b: number) => (answerKind(q.type) === "time" ? wrap(a) === wrap(b) : answerKind(q.type) === "day" ? wrap7(a) === wrap7(b) : a === b);

/** Which slip an answer is, if any. */
export function clockMistake(q: ClockQuestion, value: number): ClockTag {
  if (same(q, value, q.answer)) return "right";
  for (const [tag, v] of slips(q)) if (!same(q, v, q.answer) && same(q, value, v)) return tag;
  return "other";
}
