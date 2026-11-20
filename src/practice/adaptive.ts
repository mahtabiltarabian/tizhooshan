// The adaptive model of plan v2, section 7: a simple Elo-like rating.
//   P = 1 / (1 + e^-(θ − b))        θ ← θ + K × (s − P)
// θ is the child's ability in one subskill, b the difficulty of a level.
// The aim is about 75% right: not so easy it bores, not so hard it discourages.

import type { SkillState } from "./types";

export const TARGET_P = 0.75;

/** Starting difficulty of level 1, 2, 3 …; a guess, to recalibrate with real data. */
export const difficulty = (level: number) => level - 2;

export const probability = (theta: number, b: number) => 1 / (1 + Math.exp(-(theta - b)));

/** Score of an answer: right with no hint 1, one hint 0.7, two 0.4, three 0.2; wrong 0. Never negative. */
export function scoreOf(right: boolean, hintsUsed: number): number {
  if (!right) return 0;
  return [1, 0.7, 0.4, 0.2][Math.min(3, Math.max(0, hintsUsed))];
}

/** K is large for the first 20 answers so θ settles fast, then small so it stays steady. */
export const kFor = (n: number) => (n < 20 ? 0.4 : 0.15);

export function updateSkill(state: SkillState, level: number, score: number, now: number): SkillState {
  const p = probability(state.theta, difficulty(level));
  return { ...state, theta: state.theta + kFor(state.n) * (score - p), n: state.n + 1, updatedAt: now };
}

/** The level whose chance of a right answer is closest to 75%. */
export function pickLevel(theta: number, levels: readonly number[]): number {
  let best = levels[0];
  for (const l of levels) {
    if (Math.abs(probability(theta, difficulty(l)) - TARGET_P) < Math.abs(probability(theta, difficulty(best)) - TARGET_P)) best = l;
  }
  return best;
}

/** One step harder than the comfortable level, if there is one. */
export function challengeLevel(theta: number, levels: readonly number[]): number {
  const sorted = [...levels].sort((a, b) => a - b);
  const i = sorted.indexOf(pickLevel(theta, sorted));
  return sorted[Math.min(sorted.length - 1, i + 1)];
}

/** One step easier, after three wrong answers in a row. */
export function easierLevel(level: number, levels: readonly number[]): number {
  const lower = levels.filter((l) => l < level);
  return lower.length ? Math.max(...lower) : Math.min(...levels);
}

/** The five stages a parent sees (plan v2, section 7.4); never θ itself. */
export type Stage = 0 | 1 | 2 | 3 | 4;
export const STAGE_LABEL = ["شروع", "در حال ساخت", "مسلط", "پیشرفته", "استاد"] as const;

/**
 * Stage from ability and how much evidence there is. A few lucky answers do
 * not make anyone a master: the stage is capped by the number of answers.
 */
export function stageOf(theta: number, n: number): Stage {
  const byTheta: Stage = theta < -0.5 ? 0 : theta < 0.5 ? 1 : theta < 1.5 ? 2 : theta < 2.5 ? 3 : 4;
  const byCount: Stage = n < 3 ? 0 : n < 8 ? 1 : n < 15 ? 2 : n < 25 ? 3 : 4;
  return Math.min(byTheta, byCount) as Stage;
}
