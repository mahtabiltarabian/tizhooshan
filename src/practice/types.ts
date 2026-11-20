// Phase 2 data, kept on the device (IndexedDB) and later synced to the
// server. A question is never stored, only how to rebuild it: tool, type,
// level, seed and generator version (plan v2, section 9).

/** One child on this device. No full name, no exact birth date. */
export interface Profile {
  id: string;
  nickname: string;
  /** Index into AVATARS. */
  avatar: number;
  grade: 4 | 5 | 6;
  /** Solar Hijri year (1393), never a full date. */
  birthYear: number;
  /** Minutes of practice a day; after that the session ends with a summary. */
  dailyLimitMin: number;
  createdAt: number;
}

/** A subskill is one question type of one tool: "clock:angle". */
export type SkillKey = string;
export const skillKey = (tool: string, type: string): SkillKey => `${tool}:${type}`;
export const splitSkill = (key: SkillKey) => {
  const i = key.indexOf(":");
  return { tool: key.slice(0, i), type: key.slice(i + 1) };
};

export type AttemptMode = "practice" | "review" | "challenge" | "daily" | "exam";

/** One answered question. `id` is made on the device, so sending twice is safe. */
export interface Attempt {
  id: string;
  childId: string;
  tool: string;
  type: string;
  level: number;
  seed: number;
  generatorVersion: string;
  response: unknown;
  /** "right", or the slip the wrong answer matches ("wrongWay"), or "other". */
  tag: string;
  /** 1, 0.7, 0.4 or 0.2 when right (fewer hints, more), 0 when wrong. */
  score: number;
  hintsUsed: number;
  durationMs: number;
  mode: AttemptMode;
  createdAt: number;
  /**
   * Review answers only: the mistake-notebook entry (its attemptId) this
   * question was for, so the server updates the same entry. Absent on
   * answers from app versions before it was added.
   */
  reviewOf?: string;
  /** Set once the server has it. */
  synced?: boolean;
}

/** Ability in one subskill. Never shown to the child. */
export interface SkillState {
  childId: string;
  skill: SkillKey;
  theta: number;
  n: number;
  updatedAt: number;
}

/** Mistake notebook: a wrong question comes back after 1, 3 and 7 days, with a new seed. */
export interface ReviewItem {
  childId: string;
  /** The attempt that was wrong. */
  attemptId: string;
  skill: SkillKey;
  level: number;
  step: 1 | 3 | 7;
  dueAt: number;
}

export const DAY = 86_400_000;
