import { describe, expect, it } from "vitest";
import { decodeRule, machineMistake, makeMachineQuestion, type Level, type MachineQuestionType, type NumberQuestion } from "@/generators/number-machine";
import { makeSortQuestion, sortMistake } from "@/generators/sorting";
import { MACHINE_GUIDE } from "./guide";
import { TRY_TYPE_LABEL } from "./MachineTryPanel";

// The hand-picked scenes of the teacher guide, rebuilt the way MachineTool reads its link.
const examples = MACHINE_GUIDE.examples ?? [];
const params = (hash: string) => new URLSearchParams(hash);

/** The try question of a link, as MachineTool builds it (3 examples, ÷ allowed unless div=0). */
function tryQuestion(hash: string) {
  const p = params(hash);
  const type = p.get("try")!;
  const level = Number(p.get("level")) as Level;
  const seed = Number(p.get("seed"));
  const ex = Number(p.get("ex"));
  const options = { examples: (ex === 2 || ex === 3 || ex === 4 ? ex : 3) as 2 | 3 | 4, division: p.get("div") !== "0" };
  return type === "sort" ? makeSortQuestion(level, seed) : makeMachineQuestion(type as MachineQuestionType, level, seed, options);
}
const at = (hash: string) => {
  const q = tryQuestion(hash);
  if (q.type === "sort" || q.type === "build") throw new Error(`not a number question: ${hash}`);
  return q as NumberQuestion;
};

describe("number machine: hand-picked examples", () => {
  it("every try link names a real type, level and seed and builds", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("try="))) {
      const p = params(ex.hash);
      expect(Object.keys(TRY_TYPE_LABEL)).toContain(p.get("try"));
      expect([1, 2, 3]).toContain(Number(p.get("level")));
      expect(Number.isInteger(Number(p.get("seed")))).toBe(true);
      expect(tryQuestion(ex.hash)).toBeTruthy();
    }
  });

  it("show and explore links parse", () => {
    for (const ex of examples.filter((e) => !e.hash.startsWith("try="))) {
      const v = params(ex.hash).get("show") ?? params(ex.hash).get("explore")!;
      const [kind, ...rest] = v.split("-");
      if (kind === "m" || kind === "r") expect(decodeRule(rest[1])).not.toBeNull();
      else expect(kind).toBe("s");
    }
  });

  it("each misconception scene holds its trap", () => {
    // 0: the three reverse-machine slips are all distinct wrong answers.
    const rev = at("try=reverse&level=2&seed=8");
    expect([rev.answer, machineMistake(rev, 141), machineMistake(rev, 153), machineMistake(rev, 9)]).toEqual([13, "noInvert", "sameOps", "keepOrder"]);
    // 1: "+8" from the first example only.
    const guess = at("try=guess&level=1&seed=7");
    expect([guess.answer, machineMistake(guess, 20)]).toEqual([36, "addOnly"]);
    // 2: the steps in the other order.
    const run = at("try=run&level=2&seed=16");
    expect([run.answer, machineMistake(run, 34)]).toEqual([42, "order"]);
    // 3: a and b swapped, and the numbers in front of them dropped.
    const op = at("try=operator&level=1&seed=1");
    expect([op.answer, machineMistake(op, 20), machineMistake(op, 9)]).toEqual([25, "swapped", "noCoef"]);
    // 4: option 2 sorts the whole row, option 4 swaps boxes that are not neighbours.
    const sort = tryQuestion("try=sort&level=2&seed=27");
    if (sort.type !== "sort") throw new Error("sort");
    expect([sortMistake(sort, 1), sortMistake(sort, 3)]).toEqual(["fullSort", "nonNeighbour"]);
    // The notes quote these answers too.
    expect(at("try=operator&level=3&seed=6").answer).toBe(22);
    const loop = tryQuestion("try=sort&level=1&seed=14");
    if (loop.type !== "sort") throw new Error("sort");
    expect([loop.answer, sortMistake(loop, 29), sortMistake(loop, 10)]).toEqual([13, "loopMore", "grouped"]);
  });

  it("every misconception scene is a link the test above checks", () => {
    const checked = ["try=reverse&level=2&seed=8", "try=guess&level=1&seed=7", "try=run&level=2&seed=16", "try=operator&level=1&seed=1", "try=sort&level=2&seed=27"];
    MACHINE_GUIDE.misconceptions.forEach((_, i) => expect(examples.find((e) => e.for === i)?.hash).toBe(checked[i]));
  });
});
