import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CUBE_NETS, oppositePairs, pickRoot } from "./cube-nets";
import {
  cubeFaces,
  EASY_NETS,
  isDirected,
  isPossible,
  makeQuestion,
  ROTATIONS,
  sameCube,
  scorePlacement,
  SLOTS,
  solveNet,
  viewKey,
  type Level,
} from "./cube-questions";
import { mulberry32 } from "./random";

const level = fc.constantFrom<Level>(1, 2, 3);
const seed = fc.integer({ min: 0, max: 1_000_000 });

describe("rotations", () => {
  it("has the 24 rotations of a cube, all distinct", () => {
    expect(ROTATIONS).toHaveLength(24);
    expect(new Set(ROTATIONS.map((m) => m.join(","))).size).toBe(24);
  });
});

describe("folded cube (physical model)", () => {
  it("puts the middle face on top and folds its neighbours down beside it", () => {
    const cross = CUBE_NETS[9]; // the cross: (1,0) (0,1) (1,1) (2,1) (3,1) (1,2)
    const net = { netIndex: 9, cells: cross, symbols: ["a", "b", "c", "d", "e", "f"], turns: [0, 0, 0, 0, 0, 0] };
    const faces = cubeFaces(net);
    // (1,1) has four neighbours, so the fold starts there and it ends on top.
    expect(pickRoot(cross)).toBe(2);
    expect(faces[2].normal).toEqual([0, 0, 1]);
    // (2,1), its +x neighbour, folds down to the +x side; (1,2), its +y neighbour, to +y.
    expect(faces[3].normal).toEqual([1, 0, 0]);
    expect(faces[5].normal).toEqual([0, 1, 0]);
  });

  it("gives six faces with six different normals, each up vector on its face", () => {
    for (const cells of CUBE_NETS) {
      const net = { netIndex: 0, cells, symbols: ["1", "2", "3", "4", "5", "6"], turns: [0, 1, 2, 3, 0, 1] };
      const faces = cubeFaces(net);
      expect(new Set(faces.map((f) => f.normal.join(","))).size).toBe(6);
      for (const f of faces) expect(f.up[0] * f.normal[0] + f.up[1] * f.normal[1] + f.up[2] * f.normal[2]).toBe(0);
    }
  });
});

describe("makeQuestion", () => {
  it("is deterministic for a seed", () => {
    expect(makeQuestion("makes", 2, 42)).toEqual(makeQuestion("makes", 2, 42));
  });

  it("uses only the easy nets and round symbols at level 1", () => {
    fc.assert(
      fc.property(seed, (s) => {
        const q = makeQuestion("makes", 1, s);
        expect(EASY_NETS).toContain(q.net.netIndex);
        expect(q.net.symbols.some(isDirected)).toBe(false);
      }),
    );
  });

  it("opposite: the answer is the face opposite the target", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeQuestion("opposite", l, s);
        if (q.type !== "opposite") throw new Error("type");
        const pair = oppositePairs(q.net.cells).find((p) => p.includes(q.target))!;
        expect(pair).toContain(q.answer);
        expect(q.answer).not.toBe(q.target);
      }),
    );
  });

  it("makes: exactly one option is a real picture of the cube, and it is the answer", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeQuestion("makes", l, s);
        if (q.type !== "makes" && q.type !== "cannot") throw new Error("type");
        expect(q.options).toHaveLength(4);
        const possible = q.options.map((o) => isPossible(q.net, o.view));
        expect(possible.filter(Boolean)).toHaveLength(1);
        expect(possible[q.answer]).toBe(true);
        expect(new Set(q.options.map((o) => viewKey(o.view))).size).toBe(4);
      }),
      { numRuns: 300 },
    );
  });

  it("cannot: exactly one option is impossible, and it is the answer", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeQuestion("cannot", l, s);
        if (q.type !== "makes" && q.type !== "cannot") throw new Error("type");
        expect(q.options).toHaveLength(4);
        const possible = q.options.map((o) => isPossible(q.net, o.view));
        expect(possible.filter((p) => !p)).toHaveLength(1);
        expect(possible[q.answer]).toBe(false);
        expect(new Set(q.options.map((o) => viewKey(o.view))).size).toBe(4);
      }),
      { numRuns: 300 },
    );
  });

  it("shows a 'turned symbol' mistake at levels 2 and 3", () => {
    fc.assert(
      fc.property(fc.constantFrom<Level>(2, 3), seed, (l, s) => {
        const q = makeQuestion("makes", l, s);
        if (q.type !== "makes" && q.type !== "cannot") throw new Error("type");
        expect(q.options.some((o) => o.mistake === "turned")).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("touch: the answers are the four faces that are neither the target nor opposite it", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeQuestion("touch", l, s);
        if (q.type !== "touch") throw new Error("type");
        expect(q.answers).toHaveLength(4);
        const opp = oppositePairs(q.net.cells).find((p) => p.includes(q.target))!;
        for (const a of q.answers) expect(opp).not.toContain(a);
      }),
    );
  });

  it("hidden: the picture is possible and the answer is opposite the asked face", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeQuestion("hidden", l, s);
        if (q.type !== "hidden") throw new Error("type");
        expect(isPossible(q.net, q.view)).toBe(true);
        const shown = q.net.symbols.indexOf(q.view[q.slot].symbol);
        const pair = oppositePairs(q.net.cells).find((p) => p.includes(shown))!;
        expect(pair).toContain(q.answer);
        // The answer face is not in the picture.
        expect(SLOTS.map((sl) => q.view[sl].symbol)).not.toContain(q.net.symbols[q.answer]);
      }),
    );
  });

  it("missing: only the true direction of the blank symbol fits the picture", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeQuestion("missing", l, s);
        if (q.type !== "missing") throw new Error("type");
        expect(isDirected(q.net.symbols[q.blank])).toBe(true);
        expect(SLOTS.map((sl) => q.view[sl].symbol)).toContain(q.net.symbols[q.blank]);
        const fits = [0, 1, 2, 3].filter((k) => {
          const turns = [...q.net.turns];
          turns[q.blank] = k;
          return isPossible({ ...q.net, turns }, q.view);
        });
        expect(fits).toEqual([q.answer]);
      }),
      { numRuns: 200 },
    );
  });

  it("netMakes: exactly one net of four (all different shapes) folds into the picture", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeQuestion("netMakes", l, s);
        if (q.type !== "netMakes") throw new Error("type");
        expect(new Set(q.nets.map((o) => o.net.netIndex)).size).toBe(4);
        const fits = q.nets.map((o) => isPossible(o.net, q.view));
        expect(fits.filter(Boolean)).toHaveLength(1);
        expect(fits[q.answer]).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("netCannot: exactly one net of four cannot fold into the picture", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeQuestion("netCannot", l, s);
        if (q.type !== "netCannot") throw new Error("type");
        const fits = q.nets.map((o) => isPossible(o.net, q.view));
        expect(fits.filter((f) => !f)).toHaveLength(1);
        expect(fits[q.answer]).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it("place: the two pictures show all six faces, and the true layout scores as solved", () => {
    fc.assert(
      fc.property(level, seed, (l, s) => {
        const q = makeQuestion("place", l, s);
        if (q.type !== "place") throw new Error("type");
        const shown = q.views.flatMap((v) => SLOTS.map((sl) => v[sl].symbol));
        expect(new Set(shown).size).toBe(6);
        const r = scorePlacement(q.net.cells, q.faces, { symbols: q.net.symbols, turns: q.net.turns });
        expect(r.solved).toBe(true);
        // Swapping two symbols is never solved.
        const swapped = [...q.net.symbols];
        [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
        expect(scorePlacement(q.net.cells, q.faces, { symbols: swapped, turns: q.net.turns }).solved).toBe(false);
      }),
    );
  });

  it("place: a directed symbol turned the wrong way is reported as 'turned', not wrong", () => {
    const q = makeQuestion("place", 3, 11);
    if (q.type !== "place") throw new Error("type");
    const i = q.net.symbols.findIndex(isDirected);
    const turns = [...q.net.turns];
    turns[i] = (turns[i] + 1) % 4;
    const r = scorePlacement(q.net.cells, q.faces, { symbols: q.net.symbols, turns });
    expect(r.solved).toBe(false);
    expect(r.status.filter((st) => st === "turned")).toHaveLength(1);
  });

  it("solveNet: every net shape can carry the same cube", () => {
    const q = makeQuestion("place", 3, 5);
    if (q.type !== "place") throw new Error("type");
    for (const [i, shape] of CUBE_NETS.entries())
      for (const m of ROTATIONS) expect(sameCube(cubeFaces(solveNet(shape, q.faces, m, i)), q.faces)).toBe(true);
  });

  it("never shows a symbol twice on one cube picture", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion(rng() < 0.5 ? "makes" : "cannot", (1 + (i % 3)) as Level, i);
      if (q.type !== "makes" && q.type !== "cannot") continue;
      for (const o of q.options) {
        const symbols = [o.view.top.symbol, o.view.right.symbol, o.view.left.symbol];
        expect(new Set(symbols).size).toBe(3);
      }
    }
  });
});
