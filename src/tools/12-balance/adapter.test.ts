import { describe, expect, it } from "vitest";
import { balanceMistake, slips, type Level } from "@/generators/balance";
import { exchangeMistake, exchangeSlips } from "@/generators/exchange";
import { meanMistake, meanSlips } from "@/generators/mean";
import { fa } from "@/tools/registry";
import { BALANCE_ADAPTER as A } from "./adapter";
import { BALANCE_TYPE_LABEL, balancePrompt } from "./BalanceTryPanel";
import { BALANCE_PRACTICE as P } from "./practice";
import { makeTryQuestion, type AnyQ, type TryType } from "./questions";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 37 + 1);
const TYPES = Object.keys(BALANCE_TYPE_LABEL) as TryType[];
const LEVELS: Level[] = [1, 2, 3];
const MEAN_TAG: Record<string, string> = { noSubtract: "meanNoSubtract" };

/** The tool's own tag for a value, and every slip value it knows. */
function own(q: AnyQ, v: number) {
  if (q.type === "mean") {
    const t = meanMistake(q, v);
    return MEAN_TAG[t] ?? t;
  }
  return q.type === "exchange" ? exchangeMistake(q, v) : balanceMistake(q, v);
}
const slipValues = (q: AnyQ) => (q.type === "mean" ? meanSlips(q).map((s) => s.value) : q.type === "exchange" ? exchangeSlips(q).map((s) => s.value) : slips(q).map(([, v]) => v));

/** Numbers the child already sees: in the prompt, and on the scales. */
function shown(q: AnyQ) {
  const out = new Set(balancePrompt(q).match(/[۰-۹]+/g) ?? []);
  if (q.type === "balance" || q.type === "fill") {
    const pans = [...q.scales.flatMap((s) => [s.left, s.right]), ...(q.type === "fill" ? [q.target] : [])];
    for (const p of pans) for (const x of [p.k, ...p.s]) out.add(fa(x));
    q.scales.forEach((_, i) => out.add(fa(i + 1)));
  }
  return out;
}

describe("balance adapter", () => {
  it("agrees with practice.ts and the tool's own type labels", () => {
    expect(A.types).toEqual(P.types);
    expect(A.levels).toEqual(P.levels);
    expect(A.tags).toEqual(P.tags);
    expect(A.version).toBe("balance@1");
    expect(P.types.map((t) => [t.key, t.label])).toEqual(Object.entries(BALANCE_TYPE_LABEL));
    expect(P.tags.right).toBeTruthy();
    expect(P.tags.other).toBeTruthy();
  });

  it("grades like the tool's own feedback, for the answer and every slip", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const q = makeTryQuestion(type, level, seed);
          const tag = (r: unknown) => {
            const t = A.grade(type, level, seed, r);
            expect(P.tags[t], t).toBeTruthy();
            return t;
          };
          expect(tag(q.answer)).toBe("right");
          for (const v of slipValues(q)) expect(tag(v)).toBe(own(q, v));
          expect(tag(q.answer + 1000)).toBe("other");
          expect(tag(String(q.answer))).toBe("other");
          expect(tag(null)).toBe("other");
        }
  }, 60_000);

  it("hints are three lines and give nothing away", () => {
    for (const type of TYPES)
      for (const level of LEVELS)
        for (const seed of SEEDS) {
          const h = A.hints(type, level, seed);
          expect(h).toHaveLength(3);
          for (const line of h) expect(line.trim().length).toBeGreaterThan(5);
          // The answer is a number: no hint says it, unless the question itself shows it.
          const q = makeTryQuestion(type, level, seed);
          const ans = fa(q.answer);
          if (shown(q).has(ans)) continue;
          for (const line of h) expect(line.match(/[۰-۹]+/g) ?? [], `${type} ${level} ${seed}: ${line}`).not.toContain(ans);
        }
  }, 60_000);
});
