import { describe, expect, it } from "vitest";
import { analyzeShape, CUBE_NETS, type Cell } from "@/generators/cube-nets";
import { makeQuestion, type Level, type QuestionType } from "@/generators/cube-questions";
import { diceMistake, makeDiceQuestion } from "@/generators/dice";
import { CUBE_NETS_GUIDE } from "./guide";
import { isDiceType, TYPE_LABEL, type NetsType } from "./TryPanel";

// Rebuilds every hand-picked example the way the tool's hash reader does.
const examples = CUBE_NETS_GUIDE.examples ?? [];
const build = (hash: string) => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as NetsType;
  expect(type in TYPE_LABEL).toBe(true);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  const seed = Number(p.get("seed"));
  return isDiceType(type) ? makeDiceQuestion(type, level, seed) : makeQuestion(type as QuestionType, level, seed);
};
const byFor = (i: number) => examples.find((ex) => ex.for === i)!.hash;
const shapeOf = (hash: string): Cell[] =>
  new URLSearchParams(hash)
    .get("shape")!
    .split(";")
    .map((part) => part.split(",").map(Number) as unknown as Cell);

describe("cube nets hand-picked examples", () => {
  it("every try link builds its question", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("try="))) expect(build(ex.hash)).toBeTruthy();
  });

  it("show and explore links parse", () => {
    for (const ex of examples.filter((e) => !e.hash.startsWith("try="))) {
      const p = new URLSearchParams(ex.hash);
      if (p.has("shape")) expect(shapeOf(ex.hash)).toHaveLength(6);
      const show = p.get("show");
      if (show !== null && show !== "roll") expect(CUBE_NETS[Number(show) - 1]).toBeTruthy();
      if (show === "roll") expect(Number.isInteger(Number(p.get("seed")))).toBe(true);
    }
  });

  it("the picked scenes carry the targeted slip", () => {
    expect(analyzeShape(shapeOf(byFor(0))).kind).toBe("overlap");

    // The asked face sits at one end of the row of four.
    const opp = build(byFor(1));
    if (opp.type !== "opposite") throw new Error("expected an opposite question");
    const row = opp.net.cells.filter((c) => c[1] === opp.net.cells[opp.target][1]);
    expect(row).toHaveLength(4);
    const xs = row.map((c) => c[0]);
    expect([Math.min(...xs), Math.max(...xs)]).toContain(opp.net.cells[opp.target][0]);

    const makes = build(byFor(2));
    expect(makes.type === "makes" && makes.options.some((o) => o.mistake === "turned")).toBe(true);
    const cannot = build(byFor(3));
    expect(cannot.type === "cannot" && cannot.options[cannot.answer].mistake === "opposite").toBe(true);

    // All six numbers are options, so these slips are always on the board.
    const die = build(byFor(4));
    if (die.type !== "die") throw new Error("expected a die question");
    expect(diceMistake(die, 2)).toBe("nextNumber");
    const roll = build(byFor(5));
    if (roll.type !== "roll") throw new Error("expected a roll question");
    expect(roll.path).toEqual(["E"]);
    // The right face is what comes up if the die is rolled the wrong way.
    expect(diceMistake(roll, roll.start.east)).toBe("wrongWay");
  });
});
