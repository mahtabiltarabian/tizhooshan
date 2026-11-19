import { describe, expect, it } from "vitest";
import { foldNet, oppositePairs, pickRoot } from "./cube-nets";
import {
  diceMistake,
  diceSlips,
  DIR_STEP,
  DIRS,
  isStandardNet,
  makeDiceQuestion,
  ORIENTATIONS,
  roll,
  rollAll,
  STANDARD,
  type DiceQuestionType,
  type DieState,
  type Level,
  type Side,
} from "./dice";

const LEVELS: Level[] = [1, 2, 3];
const TYPES: DiceQuestionType[] = ["die", "roll"];

/** Outward direction of each side: x right, y away, z up. */
const NORMAL: Record<Side, [number, number, number]> = {
  top: [0, 0, 1],
  bottom: [0, 0, -1],
  north: [0, 1, 0],
  south: [0, -1, 0],
  east: [1, 0, 0],
  west: [-1, 0, 0],
};
const sideOf = (d: DieState, n: number) => (Object.keys(d) as Side[]).find((s) => d[s] === n)!;

/** Handedness of the 1-2-3 corner: rolling turns the die, so it never changes (a mirror would). */
function handedness(d: DieState) {
  const [a, b, c] = [1, 2, 3].map((n) => NORMAL[sideOf(d, n)]);
  return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
}

describe("rolling", () => {
  it("has 24 orientations, all standard and of the same hand", () => {
    expect(ORIENTATIONS).toHaveLength(24);
    for (const d of ORIENTATIONS) {
      expect(d.top + d.bottom).toBe(7);
      expect(d.north + d.south).toBe(7);
      expect(d.east + d.west).toBe(7);
      expect(handedness(d)).toBe(handedness(STANDARD));
    }
  });

  it("the top tips over in the direction of the roll", () => {
    for (const d of ORIENTATIONS) {
      expect(roll(d, "E").east).toBe(d.top);
      expect(roll(d, "W").west).toBe(d.top);
      expect(roll(d, "N").north).toBe(d.top);
      expect(roll(d, "S").south).toBe(d.top);
      // The two sides along the rolling edge stay put.
      expect([roll(d, "E").north, roll(d, "E").south]).toEqual([d.north, d.south]);
      expect([roll(d, "N").east, roll(d, "N").west]).toEqual([d.east, d.west]);
      // Back and forth, or four times one way, is no change.
      expect(rollAll(d, ["E", "W"])).toEqual(d);
      expect(rollAll(d, ["N", "N", "N", "N"])).toEqual(d);
    }
  });
});

describe("dice questions", () => {
  it("is the same for the same seed", () => {
    for (const t of TYPES) for (const l of LEVELS) expect(makeDiceQuestion(t, l, 42)).toEqual(makeDiceQuestion(t, l, 42));
  });

  it("gives a sound question with one right answer for 10,000 seeds of every type and level", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (let seed = 0; seed < 10_000; seed++) {
          const q = makeDiceQuestion(type, level, seed);
          expect(q.level).toBe(level);
          expect(diceMistake(q, q.answer)).toBe("right");

          if (q.type === "roll") {
            const n = q.path.length;
            if (level === 1) {
              expect(n === 1 || n === 2).toBe(true);
              expect(new Set(q.path).size).toBe(1);
            } else {
              expect(n).toBeGreaterThanOrEqual(level === 2 ? 3 : 5);
              expect(n).toBeLessThanOrEqual(level === 2 ? 5 : 8);
              expect(new Set(q.path).size).toBeGreaterThanOrEqual(2);
            }
            if (level < 3) expect(q.ask).toBe("top");
            // Walk the path cell by cell: it stays on the board.
            let [x, y] = q.from;
            for (const dir of q.path) {
              x += DIR_STEP[dir][0];
              y += DIR_STEP[dir][1];
              expect(x >= 0 && y >= 0 && x < q.w && y < q.d).toBe(true);
            }
            // Recompute with rotation vectors instead of the roll table.
            const where = new Map<number, [number, number, number]>([1, 2, 3, 4, 5, 6].map((v) => [v, NORMAL[sideOf(q.start, v)]]));
            for (const dir of q.path) {
              const [dx, dy] = DIR_STEP[dir];
              // Tipping toward (dx, dy): up goes to (dx, dy), (dx, dy) goes down.
              for (const [v, p] of where) {
                const along = p[0] * dx + p[1] * dy;
                const rest: [number, number, number] = [p[0] - along * dx, p[1] - along * dy, 0];
                where.set(v, [rest[0] + p[2] * dx, rest[1] + p[2] * dy, -along]);
              }
            }
            const want = NORMAL[q.ask];
            const truth = [...where].filter(([, p]) => p[0] === want[0] && p[1] === want[1] && p[2] === want[2]).map(([v]) => v);
            expect(truth).toEqual([q.answer]);
            for (let v = 1; v <= 6; v++) if (v !== q.answer) expect(diceMistake(q, v)).not.toBe("right");
            continue;
          }

          switch (q.kind) {
            case "opposite": {
              expect(level).toBe(1);
              expect(q.answer + q.die[q.shown]).toBe(7);
              // The answer is never one of the three numbers in the picture.
              expect([q.die.top, q.die.south, q.die.east]).not.toContain(q.answer);
              expect(diceMistake(q, q.die[q.shown])).toBe("sameFace");
              break;
            }
            case "missing": {
              expect(level).toBe(2);
              const blanks = q.net.values.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
              expect(blanks.sort()).toEqual([q.ask, q.blank].sort());
              // The asked cell's opposite is shown, so exactly one number fits.
              const fits = [1, 2, 3, 4, 5, 6].filter((v) => {
                if (q.net.values.includes(v)) return false;
                const values = [...q.net.values];
                values[q.ask] = v;
                const other = [1, 2, 3, 4, 5, 6].find((u) => !values.includes(u))!;
                values[q.blank] = other;
                return isStandardNet({ ...q.net, values });
              });
              expect(fits).toEqual([q.answer]);
              for (let v = 1; v <= 6; v++) if (v !== q.answer) expect(diceMistake(q, v)).not.toBe("other");
              break;
            }
            case "validNet": {
              expect(level).toBe(3);
              expect(new Set(q.nets.map((n) => n.netIndex)).size).toBe(4);
              const good = q.nets.map((n, i) => (isStandardNet(n) ? i : -1)).filter((i) => i >= 0);
              expect(good).toEqual([q.answer]);
              q.nets.forEach((n, i) => {
                expect([...n.values].sort()).toEqual([1, 2, 3, 4, 5, 6]);
                expect(foldNet(n.cells, pickRoot(n.cells)).valid).toBe(true);
                if (i === q.answer) expect(q.faults[i]).toBeNull();
                else {
                  const f = q.faults[i]!;
                  expect(f.pair[0] + f.pair[1]).toBe(7);
                  const [a, b] = f.pair.map((v) => n.values.indexOf(v));
                  expect(oppositePairs(n.cells).some((p) => p.includes(a) && p.includes(b))).toBe(false);
                }
              });
              break;
            }
          }
          for (const [, v] of diceSlips(q)) if (v === q.answer) expect(diceMistake(q, v)).toBe("right");
        }
  }, 240_000);

  it("rolling questions offer the wrong-way and top/bottom slips", () => {
    for (let seed = 0; seed < 500; seed++) {
      const q = makeDiceQuestion("roll", 1, seed);
      if (q.type !== "roll") throw new Error("type");
      const end = rollAll(q.start, q.path);
      expect(diceMistake(q, 7 - end.top)).toBe("topBottom");
      const back = rollAll(q.start, q.path.map((d) => ({ E: "W", W: "E", N: "S", S: "N" } as const)[d]));
      if (back.top !== end.top && back.top !== 7 - end.top) expect(diceMistake(q, back.top)).toBe("wrongWay");
    }
    expect(DIRS).toHaveLength(4);
  });
});
