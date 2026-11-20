import { describe, expect, it } from "vitest";
import { pickLevel } from "./adaptive";
import { SKILLS, toolArea } from "./catalog";
import {
  ANALYTIC_STAGES,
  byArea,
  cheer,
  EXAM_AREAS,
  EXAM_STAGES,
  nextLevels,
  placementStates,
  placementTheta,
  planPlacementRound,
  planSpeedStage,
  planStage,
  routeAfter,
  secondsFor,
  SPEED_TYPES,
  STAGE_MIX,
  STAGE_SIZE,
  startLevels,
  testScore,
} from "./exam";
import type { SkillState } from "./types";

const NOW = 1_800_000_000_000;

describe("placement", () => {
  it("one question per area each round, at the area's level, never the same skill twice", () => {
    let levels = startLevels();
    const used = new Set<string>();
    for (let round = 0; round < 3; round++) {
      const items = planPlacementRound({ catalog: SKILLS, areaOf: toolArea, levels, seed: 7 + round, used });
      expect(items.map((i) => toolArea(i.tool))).toEqual(EXAM_AREAS);
      for (const it of items) {
        expect(it.mode).toBe("placement");
        expect(it.level).toBe(levels[toolArea(it.tool)]);
        expect(used.has(`${it.tool}:${it.type}`)).toBe(false);
        used.add(`${it.tool}:${it.type}`);
      }
      levels = nextLevels(levels, items.map((it, i) => ({ area: toolArea(it.tool), right: i !== 1 })));
    }
    // Two rights: 2 → 3 → 3 (capped); two wrongs: 2 → 1 → 1.
    expect(levels).toEqual({ visual: 3, computational: 1, logical: 3 });
  });

  it("sets the starting ability of unpracticed skills so the planner picks the placed level", () => {
    for (const level of [1, 2, 3]) expect(pickLevel(placementTheta(level), [1, 2, 3])).toBe(level);
    const practiced: SkillState = { childId: "c", skill: "clock:angle", theta: -1, n: 4, updatedAt: NOW };
    const out = placementStates({ catalog: SKILLS, areaOf: toolArea, levels: { visual: 3, computational: 1 }, states: new Map([[practiced.skill, practiced]]), childId: "c", now: NOW });
    expect(out.find((s) => s.skill === "clock:angle")).toBeUndefined(); // the child's own answers win
    expect(out.every((s) => s.n === 0)).toBe(true);
    expect(out.filter((s) => toolArea(s.skill.split(":")[0]) === "visual").every((s) => s.theta === placementTheta(3))).toBe(true);
    expect(out.some((s) => toolArea(s.skill.split(":")[0]) === "logical")).toBe(false); // not placed
  });
});

describe("exam stages", () => {
  it("four stages: three analytical, then speed and accuracy", () => {
    expect(EXAM_STAGES).toHaveLength(4);
    expect(ANALYTIC_STAGES).toBe(3);
    expect(STAGE_SIZE).toBe(8);
  });

  it("a stage mixes the areas as STAGE_MIX says, different tools first, easier questions first", () => {
    for (let seed = 0; seed < 50; seed++) {
      const items = planStage({ catalog: SKILLS, areaOf: toolArea, states: new Map(), route: "same", seed });
      expect(items).toHaveLength(STAGE_SIZE);
      for (const area of EXAM_AREAS) {
        const mine = items.filter((i) => toolArea(i.tool) === area);
        expect(mine).toHaveLength(STAGE_MIX[area]!);
        expect(new Set(mine.map((i) => i.tool)).size).toBe(mine.length);
      }
      expect(items.map((i) => i.level)).toEqual([...items.map((i) => i.level)].sort((a, b) => a - b));
      expect(items.every((i) => i.mode === "exam" && i.tool !== "speed")).toBe(true);
    }
  });

  it("avoids skills already asked in the sitting", () => {
    const first = planStage({ catalog: SKILLS, areaOf: toolArea, states: new Map(), route: "same", seed: 3 });
    const used = new Set(first.map((i) => `${i.tool}:${i.type}`));
    const second = planStage({ catalog: SKILLS, areaOf: toolArea, states: new Map(), route: "same", seed: 4, used });
    expect(second.filter((i) => used.has(`${i.tool}:${i.type}`))).toEqual([]);
  });

  it("the next stage's level follows the last one: harder, the same, or easier", () => {
    expect(routeAfter(7, 8)).toBe("harder");
    expect(routeAfter(4, 8)).toBe("same");
    expect(routeAfter(2, 8)).toBe("easier");
    expect(routeAfter(0, 0)).toBe("same");
    const states = new Map(SKILLS.map((s) => [s.key, { childId: "c", skill: s.key, theta: placementTheta(2), n: 3, updatedAt: NOW }]));
    const levels = (route: "easier" | "same" | "harder") => planStage({ catalog: SKILLS, areaOf: toolArea, states, route, seed: 9 }).map((i) => i.level);
    expect(levels("same").every((l) => l === 2)).toBe(true);
    expect(levels("harder").every((l) => l === 3)).toBe(true);
    expect(levels("easier").every((l) => l === 1)).toBe(true);
  });

  it("the speed stage is tool 21's four kinds", () => {
    const items = planSpeedStage({ catalog: SKILLS, states: new Map(), route: "same", seed: 1 });
    expect(items.map((i) => `${i.tool}:${i.type}`)).toEqual(SPEED_TYPES.map((t) => `speed:${t}`));
  });

  it("times and scores like the test", () => {
    expect(secondsFor({ tool: "clock", type: "angle" })).toBe(75);
    expect(secondsFor({ tool: "speed", type: "mental" })).toBe(150);
    expect(testScore(10, 4, 20)).toEqual({ raw: 26, max: 60, percent: 43 });
    expect(testScore(0, 5, 10).percent).toBe(0); // never below zero
  });

  it("counts by area, and cheers in every case", () => {
    const items = [
      { tool: "clock", type: "angle", level: 1, seed: 1, mode: "exam" as const },
      { tool: "paper", type: "holes", level: 1, seed: 1, mode: "exam" as const },
      { tool: "logic", type: "grid", level: 1, seed: 1, mode: "exam" as const },
    ];
    const m = byArea(items, [true, false, true], toolArea);
    expect(m.get("computational")).toEqual({ right: 1, total: 1 });
    expect(m.get("visual")).toEqual({ right: 0, total: 1 });
    for (const [r, t] of [[0, 8], [1, 8], [4, 8], [6, 8], [8, 8], [0, 0]]) {
      const text = cheer(r, t);
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toMatch(/[0-9]|بد|ضعیف|رد شد/);
    }
  });
});
