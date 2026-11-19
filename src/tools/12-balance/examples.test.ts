import { describe, expect, it } from "vitest";
import { balanceMistake, type Level } from "@/generators/balance";
import { exchangeMistake } from "@/generators/exchange";
import { meanMistake } from "@/generators/mean";
import { BALANCE_TYPE_LABEL } from "./BalanceTryPanel";
import { BALANCE_GUIDE } from "./guide";
import { makeTryQuestion, type TryType } from "./questions";

// The hand-picked scenes of the teacher guide, rebuilt the way BalanceTool reads its link.
const examples = BALANCE_GUIDE.examples ?? [];
const TYPES = Object.keys(BALANCE_TYPE_LABEL);

function question(hash: string) {
  const p = new URLSearchParams(hash);
  const type = (p.get("try") ?? p.get("show"))!;
  return makeTryQuestion(type as TryType, Number(p.get("level")) as Level, Number(p.get("seed")));
}

/** The tag a typed answer gets, whatever the question's generator. */
function mistake(hash: string, value: number) {
  const q = question(hash);
  if (q.type === "mean") return meanMistake(q, value);
  if (q.type === "exchange") return exchangeMistake(q, value);
  return balanceMistake(q, value);
}

describe("balance: hand-picked examples", () => {
  it("every try and show link names a real type, level and seed and builds", () => {
    for (const ex of examples.filter((e) => !e.hash.startsWith("explore="))) {
      const p = new URLSearchParams(ex.hash);
      expect(TYPES).toContain(p.get("try") ?? p.get("show"));
      expect([1, 2, 3]).toContain(Number(p.get("level")));
      expect(question(ex.hash)).toBeTruthy();
    }
  });

  it("explore links name a topic", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("explore="))) expect(["weights", "mean", "exchange"]).toContain(new URLSearchParams(ex.hash).get("explore"));
  });

  it("each misconception scene holds its trap", () => {
    const cases: [string, number, number, string][] = [
      // [link, misconception, wrong answer, its tag]
      ["try=balance&level=1&seed=34", 0, 2, "oneSide"],
      ["try=balance&level=1&seed=34", 0, 5, "noSubtract"],
      ["try=balance&level=2&seed=7", 1, 8, "noDivide"],
      ["try=coin&level=1&seed=1", 2, 4, "halves"],
      ["try=coin&level=1&seed=1", 2, 1, "lucky"],
      ["try=age&level=3&seed=3", 3, 15, "later"],
      ["try=mean&level=2&seed=15", 4, 1, "noMultiply"],
      ["try=mean&level=2&seed=15", 4, 8, "wrongCount"],
      ["try=mean&level=3&seed=8", 5, 7, "avgOfAvgs"],
      ["try=exchange&level=2&seed=2", 6, 12, "skipLink"],
      ["try=exchange&level=2&seed=2", 6, 7, "added"],
      ["try=exchange&level=2&seed=2", 6, 8, "inverted"],
    ];
    for (const [hash, i, value, tag] of cases) {
      expect(examples.find((e) => e.for === i)?.hash).toBe(hash);
      expect(mistake(hash, value), `${hash} ${value}`).toBe(tag);
    }
  });

  it("the answers the notes quote", () => {
    const answers: [string, number][] = [
      ["try=balance&level=1&seed=34", 3],
      ["try=fill&level=1&seed=2", 17],
      ["try=balance&level=2&seed=7", 2],
      ["show=balance&level=3&seed=1", 7],
      ["try=coin&level=1&seed=1", 2],
      ["try=age&level=1&seed=9", 14],
      ["try=age&level=3&seed=3", 10],
      ["try=mean&level=2&seed=15", 15],
      ["try=mean&level=3&seed=8", 8],
      ["show=exchange&level=2&seed=9", 24],
      ["try=exchange&level=2&seed=2", 18],
    ];
    for (const [hash, a] of answers) expect(question(hash).answer, hash).toBe(a);
  });
});
