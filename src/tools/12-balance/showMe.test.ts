import { describe, it } from "vitest";
import { GOODS } from "@/generators/exchange";
import type { Level } from "@/generators/mean";
import type { ColumnsFrame } from "./Columns";
import { exchangeFeedback, exchangeHow, exchangePrompt } from "./exchangeText";
import { framesOf, type Frame } from "./frames";
import { meanFeedback, meanHow, meanPrompt } from "./meanText";
import { makeTryQuestion } from "./questions";

const LEVELS: Level[] = [1, 2, 3];
const LATIN = /[A-Za-z0-9]/;

/** Fruit counted on a list of pan items. */
function fruitCount(items: { item: object }[], good: number) {
  return items.reduce((t, v) => {
    const it = v.item as { fruit?: number; count?: number };
    return t + (it.fruit === good ? (it.count ?? 1) : 0);
  }, 0);
}

describe("show me for «میانگین» and «مبادله»", () => {
  for (const level of LEVELS)
    it(`levels the columns to the answer, level ${level}`, () => {
      for (let seed = 0; seed < 2000; seed++) {
        const q = makeTryQuestion("mean", level, seed);
        if (q.type !== "mean") throw new Error("type");
        const fs = framesOf(q) as ColumnsFrame[];
        const fail = (what: string) => new Error(`mean ${level}/${seed}: ${what}`);
        if (fs.length < 3 || fs.some((f) => f.kind !== "columns" || !f.note)) throw fail("frames");
        for (const f of fs) {
          if (f.cols.some((c) => c.blocks.length > f.max)) throw fail("column above the scale");
          // Each block id once per frame.
          const ids = f.cols.flatMap((c) => c.blocks);
          if (new Set(ids).size !== ids.length) throw fail("a block twice");
        }
        const last = fs[fs.length - 1];
        const height = q.variant === "missing" ? q.a : q.variant === "join" ? q.b : q.answer;
        if (!last.cols.every((c) => c.blocks.length === height)) throw fail("last frame is level at the answer");
        for (const text of [meanPrompt(q), meanHow(q), ...fs.map((f) => f.note)]) if (LATIN.test(text)) throw fail(`Latin letters or digits: ${text}`);
        for (const v of [q.answer, q.answer + 1, 1]) if (LATIN.test(meanFeedback(q, v).text)) throw fail("feedback digits");
      }
    }, 240_000);

  for (const level of LEVELS)
    it(`exchanges on a level scale to the answer, level ${level}`, () => {
      for (let seed = 0; seed < 2000; seed++) {
        const q = makeTryQuestion("exchange", level, seed);
        if (q.type !== "exchange") throw new Error("type");
        const fs = framesOf(q) as Extract<Frame, { kind: "scales" }>[];
        const fail = (what: string) => new Error(`exchange ${level}/${seed}: ${what}`);
        if (fs.some((f) => f.kind !== "scales" || f.scales.some((s) => s.tilt !== 0))) throw fail("level scales");
        const ask = fs[fs.length - 1].scales[fs[0].scales.length - 1];
        const good = q.variant === "compare" ? q.goods[0] : q.goods[q.to];
        // The question pan ends with the answer (compare: the chain's price; the answer is the cheaper).
        const got = fruitCount(ask.left, good);
        if (q.variant === "compare" ? got !== q.count * ((q.rates[0].p * q.rates[1].p) / q.rates[0].q) : got !== q.answer) throw fail(`pan ends with ${got}`);
        // No pan is piled too high: at most 3 rows of 4 slots.
        for (const f of fs)
          for (const s of f.scales)
            for (const side of [s.left, s.right]) {
              const slots = side.reduce((t, v) => t + ("fruit" in v.item && (v.item.count ?? 1) > 1 ? 2 : 1), 0);
              if (slots > 12) throw fail("pan too full");
            }
        for (const text of [exchangePrompt(q), exchangeHow(q), ...fs.map((f) => f.note)]) if (LATIN.test(text)) throw fail(`Latin letters or digits: ${text}`);
        for (const v of [q.answer, q.answer + 1, 1]) if (LATIN.test(exchangeFeedback(q, v).text)) throw fail("feedback digits");
        if (!q.goods.every((g) => g < GOODS.length)) throw fail("goods");
      }
    }, 240_000);
});
