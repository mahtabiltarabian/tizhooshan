import { describe, expect, it } from "vitest";
import { challengeLevel, difficulty, easierLevel, kFor, pickLevel, probability, scoreOf, stageOf, updateSkill } from "./adaptive";
import { CATALOG, SKILLS, practiceHref } from "./catalog";
import { answer } from "./record";
import { afterReview, due, fromMistake } from "./review";
import { badges, chain, dailyChallenge, dayNumber, starsOf, weekOf } from "./rewards";
import { focusSkills, planSession, SESSION_SIZE, type SessionItem, type SkillInfo } from "./session";
import { summarize } from "./summary";
import { DAY, type Attempt, type ReviewItem, type SkillState } from "./types";
import { mulberry32 } from "@/generators/random";

const NOW = Date.UTC(2026, 10, 20, 9);

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  id: "a1",
  childId: "c1",
  tool: "clock",
  type: "angle",
  level: 1,
  seed: 1,
  generatorVersion: "clock@1",
  response: 0,
  tag: "right",
  score: 1,
  hintsUsed: 0,
  durationMs: 30_000,
  mode: "practice",
  createdAt: NOW,
  ...over,
});

describe("adaptive model (plan v2, section 7.1)", () => {
  it("scores right answers by hints, never below zero", () => {
    expect([0, 1, 2, 3, 9].map((h) => scoreOf(true, h))).toEqual([1, 0.7, 0.4, 0.2, 0.2]);
    expect(scoreOf(false, 0)).toBe(0);
  });

  it("uses a large K for the first 20 answers", () => {
    expect(kFor(0)).toBe(0.4);
    expect(kFor(19)).toBe(0.4);
    expect(kFor(20)).toBe(0.15);
  });

  it("moves θ up after a right answer and down after a wrong one", () => {
    const s: SkillState = { childId: "c", skill: "clock:angle", theta: 0, n: 0, updatedAt: 0 };
    const up = updateSkill(s, 2, 1, 5);
    const down = updateSkill(s, 2, 0, 5);
    expect(up.theta).toBeCloseTo(0.2); // 0.4 × (1 − 0.5)
    expect(down.theta).toBeCloseTo(-0.2);
    expect(up.n).toBe(1);
    expect(up.updatedAt).toBe(5);
  });

  it("picks the level nearest to 75% right", () => {
    expect(pickLevel(0, [1, 2, 3])).toBe(1);
    expect(pickLevel(1.1, [1, 2, 3])).toBe(2);
    expect(pickLevel(3, [1, 2, 3])).toBe(3);
    expect(pickLevel(-3, [1, 2, 3])).toBe(1);
    const l = pickLevel(1.1, [1, 2, 3]);
    expect(Math.abs(probability(1.1, difficulty(l)) - 0.75)).toBeLessThan(0.05);
  });

  it("challenge is one step harder, and easier one step easier", () => {
    expect(challengeLevel(0, [1, 2, 3])).toBe(2);
    expect(challengeLevel(5, [1, 2, 3])).toBe(3);
    expect(easierLevel(3, [1, 2, 3])).toBe(2);
    expect(easierLevel(1, [1, 2, 3])).toBe(1);
  });

  it("a steady 75% right keeps θ near the level that gives 75%", () => {
    let s: SkillState = { childId: "c", skill: "x", theta: 0, n: 0, updatedAt: 0 };
    const rng = mulberry32(3);
    // A child whose true chance on level 2 is 75%.
    const trueTheta = difficulty(2) + Math.log(3);
    for (let i = 0; i < 400; i++) {
      const level = pickLevel(s.theta, [1, 2, 3]);
      const right = rng() < probability(trueTheta, difficulty(level));
      s = updateSkill(s, level, right ? 1 : 0, i);
    }
    expect(s.theta).toBeGreaterThan(trueTheta - 0.8);
    expect(s.theta).toBeLessThan(trueTheta + 0.8);
  });

  it("stages need both ability and enough answers", () => {
    expect(stageOf(3, 1)).toBe(0);
    expect(stageOf(3, 30)).toBe(4);
    expect(stageOf(0, 30)).toBe(1);
    expect(stageOf(-2, 30)).toBe(0);
  });
});

describe("mistake notebook (1, 3 and 7 days)", () => {
  const wrong = attempt({ id: "w1", tag: "hourStill", score: 0 });
  it("a mistake is due tomorrow at step 1", () => {
    const r = fromMistake(wrong);
    expect(r).toMatchObject({ step: 1, dueAt: NOW + DAY, skill: "clock:angle", level: 1 });
  });
  it("right moves 1 → 3 → 7 → done; wrong goes back to 1", () => {
    let r: ReviewItem | null = fromMistake(wrong);
    r = afterReview(r, true, NOW);
    expect(r).toMatchObject({ step: 3, dueAt: NOW + 3 * DAY });
    r = afterReview(r!, true, NOW);
    expect(r).toMatchObject({ step: 7, dueAt: NOW + 7 * DAY });
    expect(afterReview(r!, false, NOW)).toMatchObject({ step: 1, dueAt: NOW + DAY });
    expect(afterReview(r!, true, NOW)).toBeNull();
  });
  it("lists due items oldest first", () => {
    const a = { ...fromMistake(wrong), attemptId: "a", dueAt: NOW - 5 };
    const b = { ...fromMistake(wrong), attemptId: "b", dueAt: NOW - 50 };
    const c = { ...fromMistake(wrong), attemptId: "c", dueAt: NOW + 50 };
    expect(due([a, b, c], NOW).map((r) => r.attemptId)).toEqual(["b", "a"]);
  });
});

describe("recording an answer", () => {
  const adapter = { tool: "clock", version: "clock@1", grade: (_t: string, _l: number, _s: number, r: unknown) => (r === 1 ? "right" : "wrongWay") };
  const item: SessionItem = { tool: "clock", type: "angle", level: 2, seed: 4, mode: "practice" };
  const base = { adapter, item, hintsUsed: 1, durationMs: 12_345.6, childId: "c1", id: "x", now: NOW };

  it("grades with the adapter and scores by hints", () => {
    const r = answer({ ...base, response: 1 });
    expect(r.attempt).toMatchObject({ tag: "right", score: 0.7, hintsUsed: 1, durationMs: 12_346, generatorVersion: "clock@1", seed: 4 });
    expect(r.skill.n).toBe(1);
    expect(r.putReview).toBeUndefined();
  });
  it("a wrong answer goes into the notebook", () => {
    const r = answer({ ...base, response: 0 });
    expect(r.attempt.score).toBe(0);
    expect(r.putReview).toMatchObject({ attemptId: "x", step: 1 });
  });
  it("a review moves its notebook entry, or finishes it", () => {
    const review: ReviewItem = { childId: "c1", attemptId: "old", skill: "clock:angle", level: 2, step: 7, dueAt: NOW };
    const r = answer({ ...base, item: { ...item, mode: "review", reviewOf: "old" }, review, response: 1 });
    expect(r.doneReview).toBe("old");
    const w = answer({ ...base, item: { ...item, mode: "review", reviewOf: "old" }, review, response: 0 });
    expect(w.putReview).toMatchObject({ attemptId: "old", step: 1 });
  });
});

const CAT: SkillInfo[] = ["a", "b", "c", "d"].map((t) => ({ key: `tool:${t}`, tool: "tool", type: t, levels: [1, 2, 3] }));

describe("session plan (60% learning, 25% review, 15% challenge)", () => {
  it("has 10 questions with at most 3 reviews and 1 challenge", () => {
    const reviews: ReviewItem[] = ["a", "b", "c", "d", "e"].map((id, i) => ({ childId: "c", attemptId: id, skill: "tool:a", level: 1, step: 1, dueAt: NOW - i }));
    const plan = planSession({ catalog: CAT, states: new Map(), reviews, now: NOW, seed: 1 });
    expect(plan).toHaveLength(SESSION_SIZE);
    expect(plan.filter((i) => i.mode === "review")).toHaveLength(3);
    expect(plan.filter((i) => i.mode === "challenge")).toHaveLength(1);
    expect(plan.filter((i) => i.mode === "practice")).toHaveLength(6);
    expect(plan[0].mode).toBe("practice");
    expect(plan[plan.length - 1].mode).not.toBe("challenge");
    // Two focus skills at most.
    expect(new Set(plan.filter((i) => i.mode !== "review").map((i) => i.type)).size).toBeLessThanOrEqual(2);
  });
  it("is the same for the same seed", () => {
    const a = planSession({ catalog: CAT, states: new Map(), reviews: [], now: NOW, seed: 9 });
    const b = planSession({ catalog: CAT, states: new Map(), reviews: [], now: NOW, seed: 9 });
    expect(a).toEqual(b);
  });
  it("keeps practicing the skill being learned and skips mastered ones", () => {
    const states = new Map<string, SkillState>([
      ["tool:a", { childId: "c", skill: "tool:a", theta: 0, n: 5, updatedAt: NOW - 10 }],
      ["tool:b", { childId: "c", skill: "tool:b", theta: 3, n: 40, updatedAt: NOW }],
    ]);
    const focus = focusSkills(CAT, states, mulberry32(1));
    expect(focus[0].key).toBe("tool:a");
    expect(focus.map((f) => f.key)).not.toContain("tool:b");
  });
  it("can be limited to an assignment", () => {
    const plan = planSession({ catalog: CAT, states: new Map(), reviews: [], now: NOW, seed: 2, only: ["tool:c"] });
    expect(new Set(plan.map((i) => i.type))).toEqual(new Set(["c"]));
  });
});

describe("rewards", () => {
  it("stars: 3 with no hint, 2 with one, 1 with more, 0 when wrong", () => {
    expect(starsOf({ tag: "right", hintsUsed: 0 })).toBe(3);
    expect(starsOf({ tag: "right", hintsUsed: 1 })).toBe(2);
    expect(starsOf({ tag: "right", hintsUsed: 3 })).toBe(1);
    expect(starsOf({ tag: "noCarry", hintsUsed: 0 })).toBe(0);
  });

  it("weeks start on Saturday", () => {
    const sat = dayNumber(new Date(2026, 10, 21).getTime()); // Saturday 21 Nov 2026
    const fri = dayNumber(new Date(2026, 10, 27).getTime());
    expect(new Date(2026, 10, 21).getDay()).toBe(6);
    expect(weekOf(sat)).toBe(weekOf(fri));
    expect(weekOf(sat - 1)).toBe(weekOf(sat) - 1);
  });

  it("chain: 5 days a week is enough; the running week does not break it", () => {
    const sat = dayNumber(new Date(2026, 10, 21).getTime());
    const fiveOfSeven = (w: number) => [0, 1, 2, 3, 4].map((d) => sat + 7 * w + d); // Sat … Wed, no Thu/Fri
    const days = [...fiveOfSeven(-2), ...fiveOfSeven(-1), sat + 1];
    expect(chain(days, sat + 2)).toEqual({ weeks: 2, daysThisWeek: 1 });
    expect(chain([...days, sat, sat + 2, sat + 3, sat + 4], sat + 4)).toEqual({ weeks: 3, daysThisWeek: 5 });
    // A week with 4 days breaks it.
    expect(chain([...fiveOfSeven(-3), ...fiveOfSeven(-2).slice(1), ...fiveOfSeven(-1)], sat).weeks).toBe(1);
  });

  it("the daily challenge is the same for everyone that day and rises in level", () => {
    const day = dayNumber(NOW);
    const a = dailyChallenge(CAT, day);
    expect(a).toEqual(dailyChallenge(CAT, day));
    expect(a.map((i) => i.level)).toEqual([1, 2, 3]);
    expect(new Set(a.map((i) => i.type)).size).toBe(3);
    expect(dailyChallenge(CAT, day + 1)).not.toEqual(a);
  });

  it("badges fill up and stop at the goal", () => {
    const list = badges({ attempts: Array.from({ length: 30 }, (_, i) => attempt({ id: String(i) })), reviewsDone: 12, chainWeeks: 1, dailyDone: 0, tools: 20 });
    expect(list.find((b) => b.key === "thinker")).toMatchObject({ progress: 25, goal: 25 });
    expect(list.find((b) => b.key === "fixer")).toMatchObject({ progress: 10 });
    expect(list.find((b) => b.key === "explorer")).toMatchObject({ progress: 1, goal: 20 });
  });

  it("summary counts today's minutes, due reviews and the daily challenge", () => {
    const list = [attempt({ id: "1" }), attempt({ id: "2", mode: "daily" }), attempt({ id: "3", mode: "daily" }), attempt({ id: "4", mode: "daily", tag: "other" }), attempt({ id: "5", createdAt: NOW - 3 * DAY })];
    const s = summarize(list, [fromMistake(attempt({ id: "w", createdAt: NOW - 2 * DAY }))], NOW);
    expect(s.minutesToday).toBeCloseTo(2);
    expect(s.dueReviews).toBe(1);
    expect(s.dailyDoneToday).toBe(true);
    expect(s.stars).toBe(12);
  });
});

describe("catalog", () => {
  it("every skill opens its tool in practice mode", () => {
    expect(SKILLS.length).toBeGreaterThan(0);
    for (const t of CATALOG) {
      expect(t.href).toMatch(/^\/tools\/[a-z-]+\/$/);
      expect(t.tags.right).toBeTruthy();
      expect(t.tags.other).toBeTruthy();
    }
    expect(practiceHref({ tool: "clock", type: "angle", level: 2, seed: 7 })).toBe("/tools/clock/#practice&try=angle&level=2&seed=7");
  });
});
