// What the child's home screen and the parent area show, from the stored
// data. Pure, so it is tested without a browser.

import { CATALOG } from "./catalog";
import { badges, chain, dayNumber, starsOf } from "./rewards";
import { due } from "./review";
import type { Attempt, ReviewItem } from "./types";

export interface ChildSummary {
  stars: number;
  /** Minutes practiced today (time spent on answered questions). */
  minutesToday: number;
  chainWeeks: number;
  daysThisWeek: number;
  dueReviews: number;
  dailyDoneToday: boolean;
  badges: ReturnType<typeof badges>;
}

export function summarize(attempts: readonly Attempt[], reviews: readonly ReviewItem[], now: number): ChildSummary {
  const today = dayNumber(now);
  const days = attempts.filter((a) => a.mode !== "speed" || a.tag === "right").map((a) => dayNumber(a.createdAt));
  const { weeks, daysThisWeek } = chain(days, today);
  // A review answered right moved a notebook entry on: count those.
  const reviewsDone = attempts.filter((a) => a.mode === "review" && a.tag === "right").length;
  const dailyDays = new Map<number, number>();
  for (const a of attempts) if (a.mode === "daily") dailyDays.set(dayNumber(a.createdAt), (dailyDays.get(dayNumber(a.createdAt)) ?? 0) + 1);
  const dailyDone = [...dailyDays.values()].filter((n) => n >= 3).length;
  return {
    stars: attempts.filter((a) => a.mode !== "exam").reduce((s, a) => s + starsOf(a), 0),
    minutesToday: attempts.filter((a) => dayNumber(a.createdAt) === today).reduce((s, a) => s + Math.min(a.durationMs, 10 * 60_000), 0) / 60_000,
    chainWeeks: weeks,
    daysThisWeek,
    dueReviews: due(reviews, now).length,
    dailyDoneToday: (dailyDays.get(today) ?? 0) >= 3,
    badges: badges({ attempts, reviewsDone, chainWeeks: weeks, dailyDone, tools: CATALOG.length }),
  };
}

/** Time left today, in milliseconds, under the parent's daily limit. */
export const timeLeftToday = (s: ChildSummary, limitMin: number) => Math.max(0, (limitMin - s.minutesToday) * 60_000);
