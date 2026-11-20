import { describe, expect, it } from "vitest";
import { makePuzzleQuestion, type Level, type PuzzleQuestionType } from "@/generators/puzzle";
import { buildResponse, PUZZLE_ADAPTER as A } from "./adapter";
import { movePlacement, targetSpot } from "./layout";
import { poseOf } from "./Pictures";
import { PUZZLE_PRACTICE as P } from "./practice";
import { PUZZLE_TYPE_LABEL } from "./PuzzleTryPanel";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(PUZZLE_TYPE_LABEL) as PuzzleQuestionType[];
const LEVELS: Level[] = [1, 2, 3];

describe("puzzle adapter", () => {
  it("agrees with practice.ts and the tool's own type labels", () => {
    expect(A.types).toEqual(P.types);
    expect(A.levels).toEqual(P.levels);
    expect(A.tags).toEqual(P.tags);
    expect(A.version).toBe("puzzle@1");
    expect(P.types.map((t) => [t.key, t.label])).toEqual(Object.entries(PUZZLE_TYPE_LABEL));
  });

  // Questions are slow to build (the solver runs), so one test per type with room to finish.
  it.each(TYPES)(
    "%s: grades like the tool's own feedback, for the answer and every slip",
    (type) => {
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makePuzzleQuestion(type, level, seed);
          const tag = (r: unknown) => {
            const t = A.grade(type, level, seed, r);
            expect(P.tags[t], t).toBeTruthy();
            return t;
          };
          expect(tag("x")).toBe("other");
          if (q.type === "build") {
            // The solution laid on the board the way the tool lays it, then read back as the panel reports it.
            const spot = targetSpot(q.target);
            const left = [...q.solution];
            const take = (k: string) => left.splice(left.findIndex((p) => p.kind === k), 1)[0];
            const poses = q.kinds.map((k) => poseOf(movePlacement(take(k), spot)));
            const right = buildResponse(poses, spot);
            expect(tag(right)).toBe("right");
            expect(tag(right.map((p, i) => (i ? p : null)))).toBe("crooked");
            expect(tag(right.map((p, i) => (i || !p ? p : { ...p, x: p.x + 40 })))).toBe("outside");
            if (right.length > 1) expect(tag([right[0], right[0], ...right.slice(2)])).toMatch(/^(overlap|gap)$/);
            expect(tag(right.slice(1))).toBe("other");
            continue;
          }
          expect(tag(q.answer)).toBe("right");
          const n = q.type === "extra" ? q.pieces.length : q.options.length;
          for (let i = 0; i < n; i++) {
            if (i === q.answer) continue;
            const want =
              q.type === "overlay" ? (q.tags[i] === "overlap" ? "overlapOnly" : q.tags[i]) : q.type === "combine" || q.type === "complete" ? q.tags[i] : q.type === "split" ? "shape" : "notExtra";
            expect(tag(i)).toBe(want);
          }
          expect(tag(n)).toBe("other");
        }
    },
    60_000,
  );

  it.each(TYPES)(
    "%s: hints are three lines and give nothing away",
    (type) => {
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = A.hints(type, level, seed);
          expect(h).toHaveLength(3);
          // Answers are option (or piece) numbers or a whole build: a hint never names an option.
          for (const line of h) {
            expect(line.trim().length).toBeGreaterThan(5);
            expect(line).not.toMatch(/گزینه|قطعه [۰-۹]/);
          }
        }
    },
    60_000,
  );
});
