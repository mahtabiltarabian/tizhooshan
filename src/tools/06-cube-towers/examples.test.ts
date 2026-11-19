import { describe, expect, it } from "vitest";
import { makeTowerQuestion, type Level, type TowerQuestionType } from "@/generators/cube-towers";
import { BASIC_SOLIDS, solidKey } from "@/generators/solids";
import { CUBE_TOWERS_GUIDE } from "./guide";
import { TOWER_TYPE_LABEL } from "./TowerTryPanel";

// Rebuilds every hand-picked example the way the tool's hash reader does.
const examples = CUBE_TOWERS_GUIDE.examples ?? [];
const build = (hash: string) => {
  const p = new URLSearchParams(hash);
  const type = p.get("try") as TowerQuestionType;
  expect(type in TOWER_TYPE_LABEL).toBe(true);
  const level = Number(p.get("level")) as Level;
  expect([1, 2, 3]).toContain(level);
  return makeTowerQuestion(type, level, Number(p.get("seed")));
};
const byFor = (i: number) => examples.find((ex) => ex.for === i)!.hash;

describe("cube towers hand-picked examples", () => {
  it("every try link builds its question", () => {
    for (const ex of examples.filter((e) => e.hash.startsWith("try="))) expect(build(ex.hash)).toBeTruthy();
  });

  it("show and explore links name a known part or solid", () => {
    for (const ex of examples.filter((e) => !e.hash.startsWith("try="))) {
      const p = new URLSearchParams(ex.hash);
      const show = p.get("show");
      if (show !== null) expect(["layers", "paint", "solids"]).toContain(show);
      if (p.has("solid")) expect(BASIC_SOLIDS[Number(p.get("solid")) - 1]).toBeTruthy();
    }
  });

  it("the picked scenes carry the targeted slip", () => {
    const count = build(byFor(0));
    expect(count.type === "count" && count.hidden > 0 && count.mistakes.includes("visibleOnly")).toBe(true);
    const front = build(byFor(1));
    expect(front.type === "front" && front.mistakes.includes("mirrored")).toBe(true);
    const views = build(byFor(2));
    expect(views.type === "build" && views.views.top === undefined && views.solutions > 1 && views.max > views.min).toBe(true);
    expect(byFor(3)).toBe("show=paint");
    const cube = build(byFor(4));
    expect(cube.type === "solid" && cube.kind === "count" && solidKey(cube.solid) === "prism4cube" && cube.part === "edges").toBe(true);
    if (cube.type === "solid") expect(cube.mistakes).toEqual(expect.arrayContaining(["visibleOnly", "hiddenTwice"]));
    const prism = build(byFor(5));
    expect(prism.type === "solid" && prism.part === "edges" && prism.mistakes.includes("baseSides")).toBe(true);
    const reverse = build(byFor(6));
    expect(reverse.type === "solid" && reverse.kind === "reverse" && reverse.given === "edges").toBe(true);
    if (reverse.type === "solid") expect(reverse.mistakes).toEqual(expect.arrayContaining(["nIsGiven", "wrongDivide"]));
  });
});
