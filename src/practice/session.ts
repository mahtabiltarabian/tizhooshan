// "Today's game": the plan for one practice session (plan v2, section 7.2).
// About 60% the skills being learned, 25% review of past mistakes, 15% one
// step harder as a challenge. Every question is (tool, type, level, seed).

import { challengeLevel, pickLevel, stageOf } from "./adaptive";
import { due } from "./review";
import { mulberry32, randInt, type Rng } from "@/generators/random";
import { splitSkill, type AttemptMode, type ReviewItem, type SkillKey, type SkillState } from "./types";

export interface SkillInfo {
  key: SkillKey;
  tool: string;
  type: string;
  levels: readonly number[];
}

export interface SessionItem {
  tool: string;
  type: string;
  level: number;
  seed: number;
  mode: AttemptMode;
  /** For a review: the notebook entry it answers. */
  reviewOf?: string;
}

export const SESSION_SIZE = 10;
export const MAX_REVIEWS = 3;
export const CHALLENGES = 1;

const freshSeed = (rng: Rng) => randInt(rng, 1_000_000);

/**
 * Two focus skills: the one most recently practiced and not yet mastered
 * (so learning continues), and one not yet mastered that was seen least
 * recently (so the child meets every tool over time). `only` limits the
 * choice, e.g. to a teacher's assignment.
 */
export function focusSkills(catalog: readonly SkillInfo[], states: ReadonlyMap<SkillKey, SkillState>, rng: Rng, only?: readonly SkillKey[]): SkillInfo[] {
  const pool = only?.length ? catalog.filter((s) => only.includes(s.key)) : catalog;
  if (!pool.length) return [];
  const learning = pool.filter((s) => {
    const st = states.get(s.key);
    return !st || stageOf(st.theta, st.n) < 2;
  });
  const choices = learning.length ? learning : pool;
  const seen = choices.filter((s) => states.has(s.key)).sort((a, b) => states.get(b.key)!.updatedAt - states.get(a.key)!.updatedAt);
  const unseen = choices.filter((s) => !states.has(s.key));
  const first = seen[0] ?? unseen[randInt(rng, unseen.length)];
  const rest = choices.filter((s) => s.key !== first.key);
  if (!rest.length) return [first];
  // Least recently practiced; unseen skills count as oldest, picked at random among themselves.
  const fresh = rest.filter((s) => !states.has(s.key));
  const second = fresh.length ? fresh[randInt(rng, fresh.length)] : rest.sort((a, b) => states.get(a.key)!.updatedAt - states.get(b.key)!.updatedAt)[0];
  return [first, second];
}

export function planSession(opts: {
  catalog: readonly SkillInfo[];
  states: ReadonlyMap<SkillKey, SkillState>;
  reviews: readonly ReviewItem[];
  now: number;
  seed: number;
  size?: number;
  only?: readonly SkillKey[];
}): SessionItem[] {
  const { catalog, states, now } = opts;
  const size = opts.size ?? SESSION_SIZE;
  const rng = mulberry32(opts.seed);
  const theta = (key: SkillKey) => states.get(key)?.theta ?? 0;
  const known = new Map(catalog.map((s) => [s.key, s]));

  const reviews: SessionItem[] = due(opts.reviews, now)
    .filter((r) => known.has(r.skill))
    .slice(0, Math.min(MAX_REVIEWS, Math.floor(size / 3)))
    .map((r) => ({ ...splitSkill(r.skill), level: r.level, seed: freshSeed(rng), mode: "review", reviewOf: r.attemptId }));

  const focus = focusSkills(catalog, states, rng, opts.only);
  if (!focus.length) return reviews;
  const challenges: SessionItem[] = Array.from({ length: Math.min(CHALLENGES, size - reviews.length) }, (_, i) => {
    const s = focus[i % focus.length];
    return { tool: s.tool, type: s.type, level: challengeLevel(theta(s.key), s.levels), seed: freshSeed(rng), mode: "challenge" };
  });
  const learning: SessionItem[] = Array.from({ length: size - reviews.length - challenges.length }, (_, i) => {
    const s = focus[i % focus.length];
    return { tool: s.tool, type: s.type, level: pickLevel(theta(s.key), s.levels), seed: freshSeed(rng), mode: "practice" };
  });

  // Start easy, mix reviews in, keep the challenge for late in the session.
  const out = [...learning];
  reviews.forEach((r, i) => out.splice(Math.min(out.length, 2 + i * 3), 0, r));
  challenges.forEach((c) => out.splice(Math.max(1, out.length - 2), 0, c));
  return out;
}
