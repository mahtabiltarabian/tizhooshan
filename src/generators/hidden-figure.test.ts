import { describe, expect, it } from "vitest";
import {
  changed,
  distinctChanges,
  hiddenAt,
  makeHiddenQuestion,
  missingSides,
  placements,
  sameShape,
  shapeOf,
  sidesOf,
  slipOf,
  type HPt,
  type Level,
} from "./hidden-figure";

const levels: Level[] = [1, 2, 3];

describe("finding a hidden shape", () => {
  it("finds a shape on the lines, also where it is made of parts of longer lines", () => {
    const corner = shapeOf("corner");
    // A 2×2 square cut by one diagonal: the corner triangle is in it once at the bottom left.
    const square = sidesOf([
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ]);
    expect(placements([...square, [[0, 4], [4, 0]]], shapeOf("wedge"))).toHaveLength(0);
    expect(placements([...square, [[4, 0], [0, 4]]], changed(shapeOf("wedge"), "rot90"))).toHaveLength(1);
    // Two crossing diagonals make small triangles at their crossing.
    const x = [...square, [[0, 0], [4, 4]] as [HPt, HPt], [[4, 0], [0, 4]] as [HPt, HPt]];
    expect(placements(x, shapeOf("roof"))).toHaveLength(1);
    expect(placements(x, corner)).toHaveLength(0);
  });

  it("knows which turns and flips look different", () => {
    expect(distinctChanges(shapeOf("corner")).flipped).toHaveLength(0);
    expect(distinctChanges(shapeOf("corner")).rotated).toHaveLength(3);
    expect(distinctChanges(shapeOf("house")).rotated).toHaveLength(3);
    expect(distinctChanges(shapeOf("slant")).rotated).toEqual(["rot90", "rot270"]);
    expect(distinctChanges(shapeOf("slant")).flipped.length).toBeGreaterThan(0);
    expect(sameShape(changed(shapeOf("slant"), "rot180"), shapeOf("slant"))).toBe(true);
  });

  it("lists missing sides of a placed shape", () => {
    const roof = shapeOf("roof");
    expect(missingSides(sidesOf(roof).slice(0, 2), roof)).toEqual([2]);
  });
});

describe("hidden-figure questions", () => {
  it("is the same for the same seed", () => {
    for (const l of levels) expect(makeHiddenQuestion(l, 42)).toEqual(makeHiddenQuestion(l, 42));
  });

  it("builds a question with exactly one right drawing for 10,000 seeds", () => {
    for (const l of levels) {
      const tags = new Map<string, number>();
      for (let s = 0; s < 10_000; s++) {
        const q = makeHiddenQuestion(l, s);
        const ok = (cond: boolean) => {
          if (!cond) throw new Error(`level ${l} seed ${s}`);
        };
        ok(q.options.length === 4);
        const found = q.options.map((d) => placements(d, q.shape).length);
        ok(found.filter((n) => n > 0).length === 1 && found[q.answer] === 1);
        ok(missingSides(q.options[q.answer], hiddenAt(q)).length === 0);
        q.options.forEach((d, i) => {
          if (i === q.answer) return ok(q.mistakes[i] === null);
          const slip = slipOf(d, q.shape);
          ok(slip !== null && slip.tag === q.mistakes[i]);
          // The slip shape really is on the lines (or all but one side of it).
          ok(missingSides(d, slip!.poly).length === (slip!.tag === "nearMiss" ? 1 : 0));
        });
        for (const m of q.mistakes) if (m) tags.set(m, (tags.get(m) ?? 0) + 1);
        if (l === 3) ok(q.mistakes.some((m) => m === "rotated" || m === "flipped"));
      }
      expect(tags.get("nearMiss"), `level ${l}`).toBeGreaterThan(0);
      expect(tags.get("rotated"), `level ${l}`).toBeGreaterThan(0);
      if (l > 1) expect((tags.get("flipped") ?? 0) + (tags.get("size") ?? 0), `level ${l}`).toBeGreaterThan(0);
    }
  }, 240_000);
});
