import { describe, expect, it } from "vitest";
import { askMistake, askSlips, layoutOf, makeSeatingQuestion, placeMistake, type Level, type SeatingType } from "@/generators/seating";
import { mulberry32, shuffle } from "@/generators/random";
import { SEATING_ADAPTER } from "./adapter";
import { SEATING_PRACTICE } from "./practice";
import { SEATING_TYPE_LABEL } from "./text";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(SEATING_TYPE_LABEL) as SeatingType[];
const LEVELS = [1, 2, 3] as const;
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const words = (t: string) => ` ${t.split(/[\s«»،؛:.؟?()]+/).filter(Boolean).join(" ")} `;

describe("seating adapter", () => {
  it("agrees with practice.ts and the panel", () => {
    expect(SEATING_ADAPTER.tool).toBe(SEATING_PRACTICE.tool);
    expect(SEATING_ADAPTER.types).toEqual(SEATING_PRACTICE.types);
    expect(SEATING_ADAPTER.levels).toEqual(SEATING_PRACTICE.levels);
    expect(SEATING_ADAPTER.tags).toEqual(SEATING_PRACTICE.tags);
    expect(SEATING_PRACTICE.types).toEqual(TYPES.map((key) => ({ key, label: SEATING_TYPE_LABEL[key] })));
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeSeatingQuestion(type, level as Level, seed);
          const g = (r: unknown) => {
            const tag = SEATING_ADAPTER.grade(type, level, seed, json(r));
            expect(SEATING_ADAPTER.tags[tag], tag).toBeTruthy();
            return tag;
          };
          if (q.type === "family") {
            expect(g(q.answer)).toBe("right");
            q.options.forEach((o, i) => expect(g(i)).toBe(o.tag));
          } else if (q.variant === "ask") {
            expect(g(q.answer)).toBe("right");
            for (const [, p] of askSlips(q)) expect(g(p)).toBe(askMistake(q, p));
          } else {
            expect(g(q.solution)).toBe("right");
            const lay = layoutOf(q.kind, q.n);
            const mirror = q.solution.map((s) => lay.mirror[s]);
            expect(g(mirror)).toBe(placeMistake(q, mirror).tag);
            const rng = mulberry32(seed);
            for (let k = 0; k < 6; k++) {
              const seats = shuffle(rng, q.solution);
              if (q.fixed !== null) {
                // The fixed person stays in seat 0, as on the page.
                const j = seats.indexOf(0);
                [seats[j], seats[q.fixed]] = [seats[q.fixed], seats[j]];
              }
              expect(g(seats)).toBe(placeMistake(q, seats).tag);
            }
          }
        }
    expect(SEATING_ADAPTER.grade("queue", 1, 1, "x")).toBe("other");
    expect(SEATING_ADAPTER.grade("family", 1, 1, 99)).toBe("other");
  });

  it("hints: three lines, none names the asked person or relation", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = SEATING_ADAPTER.hints(type, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // A whole arrangement has no single word to give away.
          const q = makeSeatingQuestion(type, level as Level, seed);
          const ans = q.type === "family" ? q.options[q.answer].text : q.variant === "ask" ? q.names[q.answer] : null;
          // The family rule lists the relation words of both sides on purpose (عمو، دایی …); it singles none out.
          const lines = q.type === "family" ? [h[0], h[2]] : h;
          if (ans) for (const line of lines) expect(words(line), `${type} ${level} ${seed}: ${line}`).not.toContain(words(ans));
        }
  });
});
