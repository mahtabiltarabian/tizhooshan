// Mistake notebook (plan v2, section 7.2): every wrong question comes back
// 1, 3 and 7 days later with new symbols (a new seed of the same type and
// level). A wrong answer on review starts the steps again.

import { DAY, type Attempt, type ReviewItem } from "./types";
import { skillKey } from "./types";

/** A wrong answer goes into the notebook, due tomorrow. */
export function fromMistake(a: Attempt): ReviewItem {
  return { childId: a.childId, attemptId: a.id, skill: skillKey(a.tool, a.type), level: a.level, step: 1, dueAt: a.createdAt + DAY };
}

/** After the review: next step, back to the start, or done (null). */
export function afterReview(item: ReviewItem, right: boolean, now: number): ReviewItem | null {
  if (!right) return { ...item, step: 1, dueAt: now + DAY };
  if (item.step === 1) return { ...item, step: 3, dueAt: now + 3 * DAY };
  if (item.step === 3) return { ...item, step: 7, dueAt: now + 7 * DAY };
  return null;
}

export const due = (items: readonly ReviewItem[], now: number) => items.filter((r) => r.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
