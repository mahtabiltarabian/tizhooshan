// Motivation (plan v2, section 6.3; v3 section 12): reward effort and
// building, not screen time. Stars, badges, a daily challenge, a weekly
// chain. No virtual money, no loot boxes, no pressure timers.

import { mulberry32, randInt } from "@/generators/random";
import { fa } from "@/tools/registry";
import type { SessionItem, SkillInfo } from "./session";
import { DAY, type Attempt } from "./types";

/** 3 = right with no hint, 2 = right with one hint, 1 = right with more help, 0 = not yet. */
export function starsOf(a: Pick<Attempt, "tag" | "hintsUsed">): 0 | 1 | 2 | 3 {
  if (a.tag !== "right") return 0;
  return a.hintsUsed === 0 ? 3 : a.hintsUsed === 1 ? 2 : 1;
}

/** Local day number, counted from 1 January 1970. */
export function dayNumber(t: number) {
  const d = new Date(t);
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - 0) / DAY);
}

/** The Persian week starts on Saturday. Day 0 (1 Jan 1970) was a Thursday, so day 2 was a Saturday. */
export const weekOf = (day: number) => Math.floor((day - 2) / 7);

export const DAYS_PER_WEEK = 5;

/**
 * The chain counts whole weeks with practice on at least 5 of the 7 days, so
 * Friday and a holiday or two never break it. The current week counts once
 * it has 5 days, and does not break the chain while it is still going.
 */
export function chain(practiceDays: Iterable<number>, today: number) {
  const byWeek = new Map<number, number>();
  for (const d of new Set(practiceDays)) byWeek.set(weekOf(d), (byWeek.get(weekOf(d)) ?? 0) + 1);
  const thisWeek = weekOf(today);
  const daysThisWeek = byWeek.get(thisWeek) ?? 0;
  let weeks = daysThisWeek >= DAYS_PER_WEEK ? 1 : 0;
  for (let w = thisWeek - 1; (byWeek.get(w) ?? 0) >= DAYS_PER_WEEK; w--) weeks++;
  return { weeks, daysThisWeek };
}

/**
 * The daily challenge: 3 puzzles, rising in level, the same for everyone on
 * the same date (built from the date alone, so it needs no server).
 */
export function dailyChallenge(catalog: readonly SkillInfo[], day: number): SessionItem[] {
  const rng = mulberry32(day * 7919 + 17);
  const pool = [...catalog];
  const out: SessionItem[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const s = pool.splice(randInt(rng, pool.length), 1)[0];
    const sorted = [...s.levels].sort((a, b) => a - b);
    out.push({ tool: s.tool, type: s.type, level: sorted[Math.min(sorted.length - 1, i)], seed: randInt(rng, 1_000_000), mode: "daily" });
  }
  return out;
}

export interface Badge {
  key: string;
  title: string;
  /** What earns it, in words a child reads. */
  how: string;
  progress: number;
  goal: number;
}

export function badges(opts: { attempts: readonly Attempt[]; reviewsDone: number; chainWeeks: number; dailyDone: number; tools: number }): Badge[] {
  const right = opts.attempts.filter((a) => a.tag === "right");
  const toolsTried = new Set(opts.attempts.map((a) => a.tool)).size;
  return [
    { key: "explorer", title: "کاشف", how: `همه ${fa(opts.tools)} ابزار را امتحان کن`, progress: toolsTried, goal: opts.tools },
    { key: "fixer", title: "اشتباه‌یاب", how: "۱۰ بار اشتباهت را خودت اصلاح کن (در مرور)", progress: opts.reviewsDone, goal: 10 },
    { key: "thinker", title: "بی‌راهنما", how: "۲۵ سؤال را بدون راهنمایی درست جواب بده", progress: right.filter((a) => a.hintsUsed === 0).length, goal: 25 },
    { key: "curious", title: "پرسش‌گر", how: "۱۰ بار از راهنمایی کمک بگیر و بعد درست جواب بده", progress: right.filter((a) => a.hintsUsed > 0).length, goal: 10 },
    { key: "steady", title: "پیگیر", how: "۴ هفته پشت سر هم، هر هفته ۵ روز تمرین کن", progress: opts.chainWeeks, goal: 4 },
    { key: "daily", title: "چالش‌باز", how: "۷ چالش روزانه را تمام کن", progress: opts.dailyDone, goal: 7 },
  ].map((b) => ({ ...b, progress: Math.min(b.progress, b.goal) }));
}
