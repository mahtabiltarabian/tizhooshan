// The child's profile page: everything recorded since the first day, by day,
// week, month or year (Persian calendar), and for each tool which parts were
// done and which are still waiting. Pure, so it is tested without a browser.

import { stageOf, type Stage } from "./adaptive";
import { CATALOG, toolArea, toolTitle } from "./catalog";
import { dayNumber, weekOf } from "./rewards";
import { DAY, skillKey, type Attempt, type SkillState } from "./types";
import type { Area } from "@/tools/registry";

export type Period = "day" | "week" | "month" | "year";

export const PERIODS: { key: Period; label: string; range: string }[] = [
  { key: "day", label: "روزانه", range: "۱۴ روز گذشته" },
  { key: "week", label: "هفتگی", range: "۱۲ هفته گذشته" },
  { key: "month", label: "ماهانه", range: "۱۲ ماه گذشته" },
  { key: "year", label: "سالانه", range: "همه سال‌ها" },
];

/** An answer longer than this counts as this long (the child left the screen). */
const CAP_MS = 10 * 60_000;
const ms = (a: Attempt) => Math.min(Math.max(a.durationMs, 0), CAP_MS);

// ---------- Persian calendar ----------

const UTC = { timeZone: "UTC" } as const;
const ymFormat = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  ...UTC,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** Solar Hijri year, month (1-12) and day of a local day number. */
export function persianDate(day: number) {
  const parts = ymFormat.formatToParts(new Date(day * DAY));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

const monthIndex = (day: number) => {
  const { y, m } = persianDate(day);
  return y * 12 + (m - 1);
};

export const MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
const WEEKDAYS = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];
const faDigits = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

/** "۲ آذر ۱۴۰۵" */
export function dateText(day: number, withYear = true) {
  const { y, m, d } = persianDate(day);
  return `${faDigits(d)} ${MONTHS[m - 1]}${withYear ? ` ${faDigits(y)}` : ""}`;
}
export const weekdayText = (day: number) =>
  WEEKDAYS[new Date(day * DAY).getUTCDay()];

// ---------- buckets ----------

export interface Bucket {
  key: number;
  /** Short label under the bar. */
  label: string;
  /** A second line under the bar: the month or year where it changes. */
  sub?: string;
  /** In full, for the table and the tooltip. */
  long: string;
  minutes: number;
  right: number;
  wrong: number;
  /** Days with at least one answer. */
  days: number;
}

/** The bucket key of a day, for each period. */
const keyOf: Record<Period, (day: number) => number> = {
  day: (d) => d,
  week: weekOf,
  month: monthIndex,
  year: (d) => persianDate(d).y,
};

/** The keys the chart shows, oldest first. */
function keysFor(period: Period, today: number, firstDay: number): number[] {
  const last = keyOf[period](today);
  if (period === "year") {
    const first = Math.min(keyOf.year(firstDay), last);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }
  const n = period === "day" ? 14 : 12;
  return Array.from({ length: n }, (_, i) => last - n + 1 + i);
}

function describe(
  period: Period,
  key: number,
  prev: number | null,
): Pick<Bucket, "label" | "sub" | "long"> {
  if (period === "day") {
    const { m, d } = persianDate(key);
    const changed = prev === null || persianDate(prev).m !== m;
    return {
      label: faDigits(d),
      sub: changed ? MONTHS[m - 1] : undefined,
      long: `${weekdayText(key)} ${dateText(key)}`,
    };
  }
  if (period === "week") {
    const start = key * 7 + 2; // Saturday
    const { m, d } = persianDate(start);
    const changed = prev === null || persianDate(prev * 7 + 2).m !== m;
    return {
      label: faDigits(d),
      sub: changed ? MONTHS[m - 1] : undefined,
      long: `هفته ${dateText(start, false)} تا ${dateText(start + 6)}`,
    };
  }
  if (period === "month") {
    const y = Math.floor(key / 12);
    const m = key % 12;
    const changed = prev === null || Math.floor(prev / 12) !== y;
    return {
      label: MONTHS[m],
      sub: changed ? faDigits(y) : undefined,
      long: `${MONTHS[m]} ${faDigits(y)}`,
    };
  }
  return { label: faDigits(key), long: `سال ${faDigits(key)}` };
}

export function buckets(
  attempts: readonly Attempt[],
  period: Period,
  now: number,
  startedAt: number,
): Bucket[] {
  const today = dayNumber(now);
  const keys = keysFor(period, today, dayNumber(startedAt));
  const index = new Map(keys.map((k, i) => [k, i]));
  const out: Bucket[] = keys.map((key, i) => ({
    key,
    ...describe(period, key, i ? keys[i - 1] : null),
    minutes: 0,
    right: 0,
    wrong: 0,
    days: 0,
  }));
  const days = keys.map(() => new Set<number>());
  for (const a of attempts) {
    const day = dayNumber(a.createdAt);
    const i = index.get(keyOf[period](day));
    if (i === undefined) continue;
    const b = out[i];
    b.minutes += ms(a) / 60_000;
    if (a.tag === "right") b.right++;
    else b.wrong++;
    days[i].add(day);
  }
  out.forEach((b, i) => (b.days = days[i].size));
  return out;
}

/** The first and last day a bucket list covers, to pick the answers it counts. */
export function rangeOf(
  period: Period,
  list: readonly Bucket[],
): (day: number) => boolean {
  const keys = new Set(list.map((b) => b.key));
  return (day) => keys.has(keyOf[period](day));
}

// ---------- since the start ----------

export interface Totals {
  startDay: number;
  /** Days since the start, today included. */
  sinceDays: number;
  daysPracticed: number;
  minutes: number;
  questions: number;
  right: number;
  hintsUsed: number;
  /** Right with no hint. */
  rightAlone: number;
  /** The most minutes on one day. */
  bestDay: { day: number; minutes: number } | null;
  /** Hours of the day (0-23) with the most answers. */
  favouriteHour: number | null;
}

export function totals(
  attempts: readonly Attempt[],
  createdAt: number,
  now: number,
): Totals {
  const first = attempts.reduce((m, a) => Math.min(m, a.createdAt), createdAt);
  const startDay = dayNumber(first);
  const perDay = new Map<number, number>();
  const hours = new Array<number>(24).fill(0);
  for (const a of attempts) {
    const d = dayNumber(a.createdAt);
    perDay.set(d, (perDay.get(d) ?? 0) + ms(a) / 60_000);
    hours[new Date(a.createdAt).getHours()]++;
  }
  let bestDay: Totals["bestDay"] = null;
  for (const [day, minutes] of perDay)
    if (!bestDay || minutes > bestDay.minutes) bestDay = { day, minutes };
  const topHour = hours.indexOf(Math.max(...hours));
  const right = attempts.filter((a) => a.tag === "right");
  return {
    startDay,
    sinceDays: dayNumber(now) - startDay + 1,
    daysPracticed: perDay.size,
    minutes: attempts.reduce((s, a) => s + ms(a), 0) / 60_000,
    questions: attempts.length,
    right: right.length,
    hintsUsed: attempts.filter((a) => a.hintsUsed > 0).length,
    rightAlone: right.filter((a) => a.hintsUsed === 0).length,
    bestDay,
    favouriteHour: attempts.length >= 5 ? topHour : null,
  };
}

// ---------- tools and their parts ----------

export interface PartRow {
  type: string;
  label: string;
  right: number;
  wrong: number;
  /** null: not tried yet. */
  stage: Stage | null;
  lastDay: number | null;
}

export interface ToolRow {
  tool: string;
  title: string;
  area: Area;
  href: string;
  right: number;
  wrong: number;
  minutes: number;
  parts: PartRow[];
  /** Parts with at least one answer, ever. */
  tried: number;
}

/**
 * Every tool, with its counts for the answers `inRange` keeps; each part's
 * "tried" and stage are over all time (a part done last month is done).
 */
export function toolRows(
  attempts: readonly Attempt[],
  skills: readonly SkillState[],
  inRange: (day: number) => boolean,
): ToolRow[] {
  const states = new Map(skills.map((s) => [s.skill, s]));
  return CATALOG.map((t) => {
    const mine = attempts.filter((a) => a.tool === t.tool);
    const recent = mine.filter((a) => inRange(dayNumber(a.createdAt)));
    const parts: PartRow[] = t.types.map((ty) => {
      const all = mine.filter((a) => a.type === ty.key);
      const now = recent.filter((a) => a.type === ty.key);
      const s = states.get(skillKey(t.tool, ty.key));
      return {
        type: ty.key,
        label: ty.label,
        right: now.filter((a) => a.tag === "right").length,
        wrong: now.filter((a) => a.tag !== "right").length,
        stage: all.length ? stageOf(s?.theta ?? 0, s?.n ?? all.length) : null,
        lastDay: all.length
          ? dayNumber(Math.max(...all.map((a) => a.createdAt)))
          : null,
      };
    });
    return {
      tool: t.tool,
      title: toolTitle(t.tool),
      area: toolArea(t.tool),
      href: t.href,
      right: recent.filter((a) => a.tag === "right").length,
      wrong: recent.filter((a) => a.tag !== "right").length,
      minutes: recent.reduce((s, a) => s + ms(a), 0) / 60_000,
      parts,
      tried: parts.filter((p) => p.stage !== null).length,
    };
  });
}

export interface Highlight {
  tool: string;
  title: string;
  right: number;
  total: number;
}

/** Strongest parts and parts that want more practice: at least 3 answers in the range. */
export function highlights(rows: readonly ToolRow[]): {
  strong: Highlight[];
  practice: Highlight[];
} {
  const all = rows.flatMap((r) =>
    r.parts.map((p) => ({
      tool: r.tool,
      title: `${r.title} · ${p.label}`,
      right: p.right,
      total: p.right + p.wrong,
    })),
  );
  const enough = all.filter((h) => h.total >= 3);
  const rate = (h: Highlight) => h.right / h.total;
  const strong = [...enough]
    .filter((h) => rate(h) >= 0.7)
    .sort((a, b) => rate(b) - rate(a) || b.total - a.total)
    .slice(0, 3);
  const practice = [...enough]
    .filter((h) => rate(h) < 0.6 && !strong.includes(h))
    .sort((a, b) => rate(a) - rate(b) || b.total - a.total)
    .slice(0, 3);
  return { strong, practice };
}

/** Minutes as words: "۴۵ دقیقه", "۲ ساعت و ۱۵ دقیقه". */
export function durationText(minutes: number) {
  const m = Math.round(minutes);
  if (m < 60) return `${faDigits(m)} دقیقه`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r
    ? `${faDigits(h)} ساعت و ${faDigits(r)} دقیقه`
    : `${faDigits(h)} ساعت`;
}
