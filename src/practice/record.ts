// What one answer changes: the attempt itself, the ability in that subskill,
// and the mistake notebook. Pure, so it is tested without a browser.

import { scoreOf, updateSkill } from "./adaptive";
import type { ToolAdapter } from "./adapter";
import { afterReview, fromMistake } from "./review";
import type { SessionItem } from "./session";
import { skillKey, type Attempt, type ReviewItem, type SkillState } from "./types";

export interface AnswerInput {
  adapter: Pick<ToolAdapter, "tool" | "version" | "grade">;
  item: SessionItem;
  response: unknown;
  hintsUsed: number;
  durationMs: number;
  childId: string;
  id: string;
  now: number;
  skill?: SkillState;
  /** The notebook entry, when this question is a review. */
  review?: ReviewItem;
}

export interface AnswerResult {
  attempt: Attempt;
  skill: SkillState;
  /** Notebook entry to add or update. */
  putReview?: ReviewItem;
  /** Notebook entry that is finished (right on the 7-day review). */
  doneReview?: string;
}

export function answer(x: AnswerInput): AnswerResult {
  const { item } = x;
  const tag = x.adapter.grade(item.type, item.level, item.seed, x.response);
  const right = tag === "right";
  const score = scoreOf(right, x.hintsUsed);
  const attempt: Attempt = {
    id: x.id,
    childId: x.childId,
    tool: item.tool,
    type: item.type,
    level: item.level,
    seed: item.seed,
    generatorVersion: x.adapter.version,
    response: x.response,
    tag,
    score,
    hintsUsed: x.hintsUsed,
    durationMs: Math.max(0, Math.round(x.durationMs)),
    mode: item.mode,
    createdAt: x.now,
    ...(item.mode === "review" && item.reviewOf ? { reviewOf: item.reviewOf } : {}),
  };
  const key = skillKey(item.tool, item.type);
  const skill = updateSkill(x.skill ?? { childId: x.childId, skill: key, theta: 0, n: 0, updatedAt: x.now }, item.level, score, x.now);

  if (item.mode === "review" && x.review) {
    const next = afterReview(x.review, right, x.now);
    return next ? { attempt, skill, putReview: next } : { attempt, skill, doneReview: x.review.attemptId };
  }
  if (!right) return { attempt, skill, putReview: fromMistake(attempt) };
  return { attempt, skill };
}
