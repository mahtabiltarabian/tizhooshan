// Cube-net math: fold any set of grid cells onto a unit cube and report
// where each cell lands. Pure TypeScript, no UI, shared by the app and tests.
//
// Net space: cells sit on the z = 0 plane, grid x to the right, grid y up.
// The root cell becomes the bottom face (outward normal -z) and every other
// cell folds upward (+z) around the edge it shares with its parent.

export type Vec3 = readonly [number, number, number];
export type Cell = readonly [number, number];
export type Dir = "+x" | "-x" | "+y" | "-y";

export interface FoldedFace {
  cell: Cell;
  /** Index of the parent face in `faces`, -1 for the root. */
  parent: number;
  /** Grid direction from the parent cell to this cell. */
  dir: Dir | null;
  /** Outward normal of this face on the folded cube. */
  normal: Vec3;
  /** 3D direction of this cell's grid +x and +y axes after folding. */
  ex: Vec3;
  ey: Vec3;
}

export interface FoldResult {
  /** True when the cells fold into a closed cube with no overlaps. */
  valid: boolean;
  /** Faces in breadth-first order from the root (index 0). */
  faces: FoldedFace[];
  /** Pairs of face indices that land on the same cube side (empty when valid). */
  overlaps: [number, number][];
}

const DIRS: Record<Dir, Cell> = {
  "+x": [1, 0],
  "-x": [-1, 0],
  "+y": [0, 1],
  "-y": [0, -1],
};

const neg = (v: Vec3): Vec3 => [-v[0] || 0, -v[1] || 0, -v[2] || 0];
const eq = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const key = (c: Cell) => `${c[0]},${c[1]}`;

/** Frame of the neighbour reached by stepping `dir` from a face with frame (n, ex, ey). */
function step(n: Vec3, ex: Vec3, ey: Vec3, dir: Dir): { n: Vec3; ex: Vec3; ey: Vec3 } {
  switch (dir) {
    case "+x":
      return { n: ex, ex: neg(n), ey };
    case "-x":
      return { n: neg(ex), ex: n, ey };
    case "+y":
      return { n: ey, ex, ey: neg(n) };
    case "-y":
      return { n: neg(ey), ex, ey: n };
  }
}

/** Fold `cells` (any connected set) starting from `rootIndex`. */
export function foldNet(cells: readonly Cell[], rootIndex = 0): FoldResult {
  const byKey = new Map(cells.map((c) => [key(c), c]));
  const root = cells[rootIndex];
  const faces: FoldedFace[] = [
    { cell: root, parent: -1, dir: null, normal: [0, 0, -1], ex: [1, 0, 0], ey: [0, 1, 0] },
  ];
  const seen = new Set([key(root)]);

  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    for (const dir of Object.keys(DIRS) as Dir[]) {
      const [dx, dy] = DIRS[dir];
      const next: Cell = [f.cell[0] + dx, f.cell[1] + dy];
      const k = key(next);
      if (!byKey.has(k) || seen.has(k)) continue;
      seen.add(k);
      const { n, ex, ey } = step(f.normal, f.ex, f.ey, dir);
      faces.push({ cell: byKey.get(k)!, parent: i, dir, normal: n, ex, ey });
    }
  }

  const overlaps: [number, number][] = [];
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++)
      if (eq(faces[i].normal, faces[j].normal)) overlaps.push([i, j]);

  const valid = cells.length === 6 && faces.length === 6 && overlaps.length === 0;
  return { valid, faces, overlaps };
}

/** Index pairs (into `cells`) of faces that end up opposite each other. */
export function oppositePairs(cells: readonly Cell[]): [number, number][] {
  const { valid, faces } = foldNet(cells);
  if (!valid) return [];
  const idx = (c: Cell) => cells.findIndex((x) => x[0] === c[0] && x[1] === c[1]);
  const pairs: [number, number][] = [];
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++)
      if (eq(faces[i].normal, neg(faces[j].normal))) pairs.push([idx(faces[i].cell), idx(faces[j].cell)]);
  return pairs;
}

/**
 * 3D "up" direction of a symbol drawn on `cell` and turned `quarterTurns`
 * counter-clockwise in the flat net. Two symbols agree on the cube when their
 * normals and up vectors are equal.
 */
export function symbolUp(face: FoldedFace, quarterTurns: number): Vec3 {
  // Counter-clockwise on the face: ey -> -ex -> -ey -> ex.
  const ups = [face.ey, neg(face.ex), neg(face.ey), face.ex];
  return ups[((quarterTurns % 4) + 4) % 4];
}

// ---------------------------------------------------------------------------
// Shapes: normalise, compare under rotation/reflection, enumerate hexominoes.

/** Shift cells so the smallest x and y are 0, sorted for stable comparison. */
export function normalize(cells: readonly Cell[]): Cell[] {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells
    .map((c): Cell => [c[0] - minX, c[1] - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

const TRANSFORMS: ((c: Cell) => Cell)[] = [
  ([x, y]) => [x, y],
  ([x, y]) => [-y, x],
  ([x, y]) => [-x, -y],
  ([x, y]) => [y, -x],
  ([x, y]) => [-x, y],
  ([x, y]) => [y, x],
  ([x, y]) => [x, -y],
  ([x, y]) => [-y, -x],
];

/** Canonical string for a shape, identical for all rotations and reflections. */
export function shapeKey(cells: readonly Cell[]): string {
  return TRANSFORMS.map((t) => normalize(cells.map(t)).map(key).join(";"))
    .sort()[0];
}

/** All free polyominoes with `size` cells (35 for size 6). */
export function enumeratePolyominoes(size: number): Cell[][] {
  let shapes = new Map<string, Cell[]>([[shapeKey([[0, 0]]), [[0, 0]]]]);
  for (let n = 1; n < size; n++) {
    const next = new Map<string, Cell[]>();
    for (const shape of shapes.values()) {
      const taken = new Set(shape.map(key));
      for (const [x, y] of shape)
        for (const [dx, dy] of Object.values(DIRS)) {
          const c: Cell = [x + dx, y + dy];
          if (taken.has(key(c))) continue;
          const grown = [...shape, c];
          const k = shapeKey(grown);
          if (!next.has(k)) next.set(k, normalize(grown));
        }
    }
    shapes = next;
  }
  return [...shapes.values()];
}

/** Cell with the most neighbours, so a fold starts from the middle of the net. */
export function pickRoot(cells: readonly Cell[]): number {
  const taken = new Set(cells.map(key));
  let best = 0;
  let bestCount = -1;
  cells.forEach(([x, y], i) => {
    const n = Object.values(DIRS).filter(([dx, dy]) => taken.has(key([x + dx, y + dy]))).length;
    if (n > bestCount) [best, bestCount] = [i, n];
  });
  return best;
}

export type ShapeStatus =
  | { kind: "incomplete"; count: number }
  | { kind: "disconnected" }
  | { kind: "overlap"; pairs: [number, number][] }
  | { kind: "valid"; netIndex: number };

/**
 * What a hand-drawn shape is: too few squares, not joined edge to edge,
 * folds with faces landing on each other (pairs of indices into `cells`),
 * or one of the 11 nets.
 */
export function analyzeShape(cells: readonly Cell[]): ShapeStatus {
  if (cells.length < 6) return { kind: "incomplete", count: cells.length };
  const fold = foldNet(cells, pickRoot(cells));
  if (fold.faces.length < cells.length) return { kind: "disconnected" };
  if (fold.valid) {
    const k = shapeKey(cells);
    return { kind: "valid", netIndex: CUBE_NETS.findIndex((n) => shapeKey(n) === k) };
  }
  const idx = (c: Cell) => cells.findIndex((x) => x[0] === c[0] && x[1] === c[1]);
  const pairs = fold.overlaps.map(([a, b]): [number, number] => [idx(fold.faces[a].cell), idx(fold.faces[b].cell)]);
  return { kind: "overlap", pairs };
}

/**
 * Why two opposite faces are opposite, as taught in the tool:
 * "row" = same row or column with exactly one square between them
 * (the shortcut rule); "fold" = only visible by folding.
 */
export function pairReason(cells: readonly Cell[], a: number, b: number): "row" | "fold" {
  const [ax, ay] = cells[a];
  const [bx, by] = cells[b];
  const taken = new Set(cells.map(key));
  if (ay === by && Math.abs(ax - bx) === 2 && taken.has(key([(ax + bx) / 2, ay]))) return "row";
  if (ax === bx && Math.abs(ay - by) === 2 && taken.has(key([ax, (ay + by) / 2]))) return "row";
  return "fold";
}

/** The 11 cube nets, in a fixed order (by row count, then canonical key). */
export const CUBE_NETS: readonly Cell[][] = enumeratePolyominoes(6)
  .filter((cells) => foldNet(cells).valid)
  .sort((a, b) => {
    const rows = (s: Cell[]) => Math.max(...s.map((c) => c[1]));
    return rows(a) - rows(b) || shapeKey(a).localeCompare(shapeKey(b));
  });
