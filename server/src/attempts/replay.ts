// The server's copy of a child's state: every answer, in the order it was
// given, through the app's own record.ts answer() (so the adaptive update and
// the mistake notebook are exactly the app's). Pure and deterministic: the
// same answers always give the same state, and replaying new answers onto a
// saved state gives the same result as replaying everything from scratch.

import type { Attempt as AttemptRow } from "@prisma/client";
import { adapterFor, answer, skillKey, type Attempt, type ReviewItem, type SkillState } from "../shared/practice";

/**
 * The grading the server trusts for an answer: its own when it rebuilt the
 * question with the same generator version the device used; the device's
 * when the versions differ (an older app on the device, so the server's
 * generator may build a different question from the same seed).
 */
export function effective(row: Pick<AttemptRow, "tool" | "generatorVersion" | "tag" | "score" | "serverTag" | "serverScore">) {
  const sameVersion = adapterFor(row.tool)?.version === row.generatorVersion;
  if (sameVersion && row.serverTag !== null && row.serverScore !== null) return { tag: row.serverTag, score: row.serverScore };
  return { tag: row.tag, score: row.score };
}

/** A stored row as the shared code's Attempt, with the trusted grading. */
export function toAttempt(row: AttemptRow): Attempt {
  const { tag, score } = effective(row);
  return {
    id: row.id,
    childId: row.childId,
    tool: row.tool,
    type: row.type,
    level: row.level,
    seed: row.seed,
    generatorVersion: row.generatorVersion,
    response: row.response,
    tag,
    score,
    hintsUsed: row.hintsUsed,
    durationMs: row.durationMs,
    mode: row.mode as Attempt["mode"],
    createdAt: row.createdAt.getTime(),
    ...(row.reviewOf ? { reviewOf: row.reviewOf } : {}),
  };
}

/**
 * The notebook entry a review answer was for. Answers name it (reviewOf);
 * the device used exactly that entry, or none when it was already gone, so
 * the server does the same. Answers from older apps do not name it: then it
 * is found the way the planner picked it, an entry of the same skill and
 * level that was due, the longest-due first; failing that, any due entry of
 * the same skill.
 */
function reviewFor(reviews: Map<string, ReviewItem>, a: Attempt, skill: string): ReviewItem | undefined {
  if (a.reviewOf !== undefined) return reviews.get(a.reviewOf);
  const [level, at] = [a.level, a.createdAt];
  const dueNow = [...reviews.values()].filter((r) => r.skill === skill && r.dueAt <= at).sort((a, b) => a.dueAt - b.dueAt || a.attemptId.localeCompare(b.attemptId));
  return dueNow.find((r) => r.level === level) ?? dueNow[0];
}

/** Answer order: by time, then by id. */
export const byTime = (a: Pick<Attempt, "createdAt" | "id">, b: Pick<Attempt, "createdAt" | "id">) => a.createdAt - b.createdAt || a.id.localeCompare(b.id);

export interface ChildState {
  skills: SkillState[];
  reviews: ReviewItem[];
}

/** The state after `attempts`, all given after everything in `from` (empty: from scratch). */
export function replay(childId: string, attempts: readonly Attempt[], from: ChildState = { skills: [], reviews: [] }): ChildState {
  const ordered = [...attempts].sort(byTime);
  const skills = new Map(from.skills.map((s) => [s.skill, { ...s }]));
  const reviews = new Map(from.reviews.map((r) => [r.attemptId, { ...r }]));
  for (const a of ordered) {
    const key = skillKey(a.tool, a.type);
    const review = a.mode === "review" ? reviewFor(reviews, a, key) : undefined;
    const res = answer({
      // The grading is already decided (effective()); answer() takes it as is.
      adapter: { tool: a.tool, version: a.generatorVersion, grade: () => a.tag },
      item: { tool: a.tool, type: a.type, level: a.level, seed: a.seed, mode: a.mode, reviewOf: review?.attemptId },
      response: a.response,
      hintsUsed: a.hintsUsed,
      durationMs: a.durationMs,
      childId,
      id: a.id,
      now: a.createdAt,
      skill: skills.get(key),
      review,
    });
    skills.set(key, res.skill);
    if (res.putReview) reviews.set(res.putReview.attemptId, res.putReview);
    if (res.doneReview) reviews.delete(res.doneReview);
  }
  return { skills: [...skills.values()], reviews: [...reviews.values()] };
}
