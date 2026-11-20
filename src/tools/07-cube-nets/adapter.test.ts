// The practice adapter against the tool's own generators and slips. The 3D
// scenes are slow, so only the generators are used here.

import { describe, expect, it } from "vitest";
import { oppositePairs } from "@/generators/cube-nets";
import { isDirected, makeQuestion, ROTATIONS, SLOTS, solveNet, type QuestionType } from "@/generators/cube-questions";
import { diceMistake, diceSlips, makeDiceQuestion } from "@/generators/dice";
import { fa } from "@/tools/registry";
import { CUBE_NETS_ADAPTER as A } from "./adapter";
import { CUBE_NETS_PRACTICE } from "./practice";
import { TYPE_LABEL } from "./TryPanel";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const LEVELS = [1, 2, 3] as const;
const NET_TYPES: QuestionType[] = ["opposite", "touch", "hidden", "missing", "makes", "cannot", "netMakes", "netCannot", "place"];
const tokens = (s: string) => s.match(/[۰-۹]+/g) ?? [];

describe("cube nets adapter", () => {
  it("agrees with practice.ts and the try panel", () => {
    expect(A.types).toEqual(CUBE_NETS_PRACTICE.types);
    expect(A.levels).toEqual(CUBE_NETS_PRACTICE.levels);
    expect(A.tags).toEqual(CUBE_NETS_PRACTICE.tags);
    expect(A.version).toBe("cube-nets@1");
    expect(Object.fromEntries(A.types.map((t) => [t.key, t.label]))).toEqual(TYPE_LABEL);
  });

  it("grades net questions: the answer is right and each option's slip is its tag", () => {
    const tagOf = { opposite: "oppositeSide", turned: "turned", swapped: "swapped" } as const;
    for (const type of NET_TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeQuestion(type, level, seed);
          const g = (r: unknown) => {
            const tag = A.grade(type, level, seed, r);
            expect(A.tags[tag]).toBeTruthy();
            return tag;
          };
          switch (q.type) {
            case "opposite":
              for (let i = 0; i < 6; i++) expect(g(i)).toBe(i === q.answer ? "right" : i === q.target ? "target" : "adjacent");
              break;
            case "hidden": {
              const seen = SLOTS.map((s) => q.view[s].symbol);
              for (let i = 0; i < 6; i++) expect(g(i)).toBe(i === q.answer ? "right" : seen.includes(q.net.symbols[i]) ? "visible" : "adjacent");
              break;
            }
            case "touch": {
              expect(g([...q.answers].reverse())).toBe("right");
              const opp = [0, 1, 2, 3, 4, 5].find((i) => i !== q.target && !q.answers.includes(i))!;
              expect(g([...q.answers, opp])).toBe("withOpposite");
              expect(g(q.answers.slice(0, 2))).toBe("missedSome");
              break;
            }
            case "missing":
              for (let k = 0; k < 4; k++) expect(g(k)).toBe(k === q.answer ? "right" : "turned");
              break;
            case "makes":
              q.options.forEach((o, i) => expect(g(i)).toBe(i === q.answer ? "right" : o.mistake ? tagOf[o.mistake] : "other"));
              break;
            case "netMakes":
              q.nets.forEach((o, i) => expect(g(i)).toBe(i === q.answer ? "right" : (o.mistake ?? "other")));
              break;
            case "cannot":
            case "netCannot": {
              const n = "nets" in q ? q.nets.length : q.options.length;
              for (let i = 0; i < n; i++) expect(g(i)).toBe(i === q.answer ? "right" : "possible");
              break;
            }
            case "place": {
              // Any of the 24 layouts of the cube on this net is right, as the tool scores it.
              const sol = solveNet(q.net.cells, q.faces, ROTATIONS[seed % 24]);
              expect(g({ symbols: sol.symbols, turns: sol.turns })).toBe("right");
              const swapped = [...sol.symbols];
              [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
              expect(g({ symbols: swapped, turns: sol.turns })).toBe("misplaced");
              const k = sol.symbols.findIndex(isDirected);
              if (k >= 0) expect(g({ symbols: sol.symbols, turns: sol.turns.map((t, i) => (i === k ? (t + 1) % 4 : t)) })).toBe("turned");
              // The first hint names a pair that really is opposite.
              const pair = [q.views[0].top.symbol, q.views[1].top.symbol].map((s) => q.net.symbols.indexOf(s)).sort();
              expect(oppositePairs(q.net.cells).map((p) => [...p].sort())).toContainEqual(pair);
              break;
            }
          }
          expect(g(99) === "other" || q.type === "place").toBe(true);
        }
    expect(A.grade("place", 1, 1, { symbols: [], turns: [] })).toBe("other");
  });

  it("grades dice questions like the tool's own feedback, for the answer and every slip", () => {
    for (const type of ["die", "roll"] as const)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeDiceQuestion(type, level, seed);
          expect(A.grade(type, level, seed, q.answer)).toBe("right");
          if (q.type === "die" && q.kind === "validNet") {
            q.nets.forEach((_, i) => expect(A.grade(type, level, seed, i)).toBe(i === q.answer ? "right" : "notStandard"));
            continue;
          }
          for (const [, v] of diceSlips(q)) {
            const tag = A.grade(type, level, seed, v);
            expect(tag).toBe(diceMistake(q, v));
            expect(A.tags[tag]).toBeTruthy();
          }
        }
    expect(A.grade("roll", 1, 1, "x")).toBe("other");
  });

  it("gives three hints that never show a number answer", () => {
    for (const { key } of A.types)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = A.hints(key, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // Net answers are cells, symbols and options, not numbers; "which net" is an option too.
          if (key !== "die" && key !== "roll") continue;
          const q = makeDiceQuestion(key, level, seed);
          if (q.type === "die" && q.kind === "validNet") continue;
          for (const line of h) expect(tokens(line)).not.toContain(fa(q.answer));
        }
  });
});
