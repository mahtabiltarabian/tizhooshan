import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  analyzeShape,
  CUBE_NETS,
  enumeratePolyominoes,
  foldNet,
  oppositePairs,
  pairReason,
  shapeKey,
  symbolUp,
  type Cell,
} from "./cube-nets";

const CROSS: Cell[] = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]];

describe("enumeration", () => {
  it("finds the 35 free hexominoes", () => {
    expect(enumeratePolyominoes(6)).toHaveLength(35);
  });

  it("finds exactly 11 cube nets, all distinct", () => {
    expect(CUBE_NETS).toHaveLength(11);
    expect(new Set(CUBE_NETS.map(shapeKey)).size).toBe(11);
  });
});

describe("foldNet", () => {
  it("folds the cross into a cube", () => {
    expect(foldNet(CROSS).valid).toBe(true);
  });

  it("rejects a 2x3 block", () => {
    const block: Cell[] = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
    const r = foldNet(block);
    expect(r.valid).toBe(false);
    expect(r.overlaps.length).toBeGreaterThan(0);
  });

  it("rejects a straight line of six", () => {
    const line: Cell[] = [0, 1, 2, 3, 4, 5].map((x): Cell => [x, 0]);
    expect(foldNet(line).valid).toBe(false);
  });

  it("gives the same validity from every root cell", () => {
    for (const net of CUBE_NETS)
      for (let r = 0; r < 6; r++) expect(foldNet(net, r).valid).toBe(true);
  });
});

describe("opposite faces", () => {
  it("pairs every face exactly once on each of the 11 nets", () => {
    for (const net of CUBE_NETS) {
      const pairs = oppositePairs(net);
      expect(pairs).toHaveLength(3);
      expect(new Set(pairs.flat()).size).toBe(6);
    }
  });

  it("never pairs two cells that touch on the net", () => {
    for (const net of CUBE_NETS)
      for (const [a, b] of oppositePairs(net)) {
        const [ax, ay] = net[a];
        const [bx, by] = net[b];
        expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBeGreaterThan(1);
      }
  });

  it("pairs two cells with one cell between them in a straight row", () => {
    // Rule taught in the tool: in a row of three, the ends are opposite.
    for (const net of CUBE_NETS) {
      const pairs = oppositePairs(net).map(([a, b]) => [net[a], net[b]]);
      const has = (p: Cell, q: Cell) =>
        pairs.some(
          ([a, b]) =>
            (a[0] === p[0] && a[1] === p[1] && b[0] === q[0] && b[1] === q[1]) ||
            (a[0] === q[0] && a[1] === q[1] && b[0] === p[0] && b[1] === p[1]),
        );
      const cells = new Set(net.map(([x, y]) => `${x},${y}`));
      for (const [x, y] of net) {
        if (cells.has(`${x + 1},${y}`) && cells.has(`${x + 2},${y}`)) expect(has([x, y], [x + 2, y])).toBe(true);
        if (cells.has(`${x},${y + 1}`) && cells.has(`${x},${y + 2}`)) expect(has([x, y], [x, y + 2])).toBe(true);
      }
    }
  });
});

describe("pairReason", () => {
  it("explains the cross's long column by the row rule", () => {
    // CROSS column: (1,0) (1,1) (1,2) (1,3); (1,0) and (1,2) have (1,1) between them.
    expect(pairReason(CROSS, 0, 4)).toBe("row");
  });

  it("explains a pair by the row rule on every net except the staircase", () => {
    const withoutRow = CUBE_NETS.filter((net) => !oppositePairs(net).some(([a, b]) => pairReason(net, a, b) === "row"));
    expect(withoutRow).toHaveLength(1);
    // The staircase: rows of two, each shifted by one. No three squares in a line.
    const rows = new Map<number, number>();
    for (const [, y] of withoutRow[0]) rows.set(y, (rows.get(y) ?? 0) + 1);
    expect([...rows.values()].every((n) => n <= 2)).toBe(true);
  });
});

describe("analyzeShape", () => {
  it("counts squares while the shape is incomplete", () => {
    expect(analyzeShape([[0, 0], [1, 0]])).toEqual({ kind: "incomplete", count: 2 });
  });

  it("reports squares that are not joined edge to edge", () => {
    const apart: Cell[] = [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]];
    expect(analyzeShape(apart).kind).toBe("disconnected");
  });

  it("names the overlapping faces of a shape that is not a net", () => {
    const block: Cell[] = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
    const r = analyzeShape(block);
    expect(r.kind).toBe("overlap");
    if (r.kind === "overlap") for (const [a, b] of r.pairs) expect(a).not.toBe(b);
  });

  it("recognises every net in any rotation, reflection and drawing order", () => {
    CUBE_NETS.forEach((net, i) => {
      const turned = net.map(([x, y]): Cell => [y + 3, -x + 7]);
      const mirrored = turned.map(([x, y]): Cell => [-x, y]).reverse();
      expect(analyzeShape(mirrored)).toEqual({ kind: "valid", netIndex: i });
    });
  });
});

describe("symbol orientation", () => {
  it("keeps each up vector on its face plane for any net, root and turn", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 5 }), fc.integer({ min: -8, max: 8 }), (n, root, turns) => {
        for (const face of foldNet(CUBE_NETS[n], root).faces) {
          const up = symbolUp(face, turns);
          const dot = up[0] * face.normal[0] + up[1] * face.normal[1] + up[2] * face.normal[2];
          expect(dot).toBe(0);
        }
      }),
    );
  });

  it("four quarter turns return to the start", () => {
    const face = foldNet(CROSS).faces[3];
    expect(symbolUp(face, 4)).toEqual(symbolUp(face, 0));
  });
});
