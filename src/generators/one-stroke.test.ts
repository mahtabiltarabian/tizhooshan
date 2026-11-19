import { describe, expect, it } from "vitest";
import {
  cleanDrawing,
  countSlip,
  countSlips,
  degrees,
  drawable,
  eulerPath,
  figureTag,
  isConnected,
  isStroke,
  linesOddPoints,
  makeStrokeQuestion,
  NAMED,
  oddPoints,
  type Level,
  type NamedFigure,
} from "./one-stroke";

const levels: Level[] = [1, 2, 3];

describe("one-stroke figures", () => {
  it("knows the named figures", () => {
    const odd: Record<NamedFigure, number> = { house: 2, houseX: 2, envelope: 4, bow: 0, window2: 2, window4: 4, kite: 2, star: 0 };
    for (const [name, n] of Object.entries(odd) as [NamedFigure, number][]) {
      const fig = NAMED[name]();
      expect(cleanDrawing(fig), name).toBe(true);
      expect(isConnected(fig), name).toBe(true);
      expect(oddPoints(fig).length, name).toBe(n);
      const path = eulerPath(fig);
      if (n <= 2) expect(path && isStroke(fig, path), name).toBe(true);
      else expect(path, name).toBeNull();
    }
  });

  it("starts only at an odd point when there are two", () => {
    const fig = NAMED.house();
    const [a, b] = oddPoints(fig);
    expect(eulerPath(fig, a)?.at(-1)).toBe(b);
    const even = degrees(fig).findIndex((d) => d % 2 === 0);
    expect(eulerPath(fig, even)).toBeNull();
  });

  it("sees how lines-through counting goes wrong", () => {
    // A T: one line straight through the middle point, one going off it.
    const t = { pts: [[0, 0], [1, 0], [2, 0], [1, 1]] as [number, number][], edges: [[0, 1], [1, 2], [1, 3]] as [number, number][] };
    expect(oddPoints(t)).toHaveLength(4);
    expect(linesOddPoints(t)).toHaveLength(3);
  });
});

describe("one-stroke questions", () => {
  it("is the same for the same seed", () => {
    for (const l of levels) expect(makeStrokeQuestion(l, 42)).toEqual(makeStrokeQuestion(l, 42));
  });

  it("builds a solvable question with one answer for 10,000 seeds", () => {
    const asks = new Set<string>();
    for (const l of levels)
      for (let s = 0; s < 10_000; s++) {
        const q = makeStrokeQuestion(l, s);
        asks.add(`${l}${q.ask}`);
        const ok = (cond: boolean) => {
          if (!cond) throw new Error(`level ${l} seed ${s} (${q.ask})`);
        };
        const figs = q.ask === "which" ? q.options : [q.fig];
        for (const f of figs) ok(cleanDrawing(f) && isConnected(f));
        if (q.ask === "which") {
          ok(q.options.length === 4);
          ok(q.options.filter(drawable).length === 1 && drawable(q.options[q.answer]));
          const path = eulerPath(q.options[q.answer]);
          ok(!!path && isStroke(q.options[q.answer], path));
          q.options.forEach((f, i) => ok(q.mistakes[i] === (i === q.answer ? null : figureTag(f))));
          ok(q.options.every((f) => f.edges.length >= (l === 1 ? 4 : 8)));
        } else if (q.ask === "count") {
          ok(q.answer === oddPoints(q.fig).length && q.answer >= 2);
          ok(countSlip(q, q.answer) === null);
        } else {
          const odd = oddPoints(q.fig);
          ok(odd.length === 2);
          ok(new Set(q.choices).size === 4);
          if (q.ask === "start") {
            // Exactly one choice can start a stroke.
            ok(q.choices.filter((v) => eulerPath(q.fig, v) !== null).length === 1);
            ok(eulerPath(q.fig, q.choices[q.answer]) !== null);
          } else {
            ok(odd.includes(q.from));
            const path = eulerPath(q.fig, q.from)!;
            ok(isStroke(q.fig, path) && path.at(-1) === q.choices[q.answer]);
            // No stroke from the start point ends anywhere else.
            ok(q.choices.filter((v) => v !== q.choices[q.answer]).every((v) => v === q.from || degrees(q.fig)[v] % 2 === 0));
          }
          q.mistakes.forEach((m, i) => ok((m === null) === (i === q.answer)));
        }
      }
    expect([...asks].sort()).toEqual(["1which", "2which", "3count", "3end", "3start"]);
  }, 240_000);

  it("names the usual slips", () => {
    let seen = 0;
    for (let s = 0; s < 200; s++) {
      const q = makeStrokeQuestion(3, s);
      if (q.ask !== "count") continue;
      for (const [tag, v] of countSlips(q.fig)) if (v !== q.answer) expect(countSlip(q, v), tag).not.toBeNull();
      const used = degrees(q.fig).filter((d) => d > 0).length;
      if (!countSlips(q.fig).slice(0, 1).some(([, v]) => v === used - q.answer) && used - q.answer !== q.answer) expect(countSlip(q, used - q.answer)).toBe("countedEven");
      expect(countSlip(q, q.answer + 100)).toBeNull();
      seen++;
    }
    expect(seen).toBeGreaterThan(10);
    const tags = new Set<string>();
    for (let s = 0; s < 500; s++) {
      const q = makeStrokeQuestion(2, s);
      if (q.ask === "which") q.mistakes.forEach((m) => m && tags.add(m));
    }
    expect([...tags].sort()).toEqual(["countLines", "fourOdd", "manyOdd"]);
  });
});
