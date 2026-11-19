// Tool 4: overlap and puzzles. Shapes live on a lattice: unit cells, each cut
// by both diagonals into four triangles ("tris": 0 top, 1 right, 2 bottom,
// 3 left). Every piece — the seven tangram pieces and a few simpler ones —
// is a set of tris, so placing, turning, flipping and checking a fit are
// exact. A small solver tiles a shape with given pieces; it checks every
// question has exactly one right answer.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type Pt = [number, number];

// ── Lattice ──────────────────────────────────────────────────────────────

const OFF = 64;
/** Id of tri q of cell (x, y); x and y in −64 … 191. Moving a cell by (dx, dy) adds dx·1024 + dy·4. */
export const triId = (x: number, y: number, q: number) => ((x + OFF) * 256 + (y + OFF)) * 4 + q;
export function triOf(id: number): [number, number, number] {
  const r = id >> 2;
  return [Math.floor(r / 256) - OFF, (r % 256) - OFF, id & 3];
}
export const shiftId = (id: number, dx: number, dy: number) => id + dx * 1024 + dy * 4;

const CENTROID: Pt[] = [
  [0.5, 1 / 6],
  [5 / 6, 0.5],
  [0.5, 5 / 6],
  [1 / 6, 0.5],
];

export function centroid(id: number): Pt {
  const [x, y, q] = triOf(id);
  return [x + CENTROID[q][0], y + CENTROID[q][1]];
}

/** The tri a point lies in. */
export function triAt(px: number, py: number) {
  const x = Math.floor(px);
  const y = Math.floor(py);
  const dx = px - x - 0.5;
  const dy = py - y - 0.5;
  const q = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 0 : 2) : dx > 0 ? 1 : 3;
  return triId(x, y, q);
}

/** Corners of a tri, clockwise on screen. */
export function triCorners(id: number): Pt[] {
  const [x, y, q] = triOf(id);
  const c: Pt = [x + 0.5, y + 0.5];
  const sq: Pt[] = [
    [x, y],
    [x + 1, y],
    [x + 1, y + 1],
    [x, y + 1],
  ];
  return [sq[q], sq[(q + 1) % 4], c];
}

/** The three neighbours of a tri: across the cell side, then the two in the same cell. */
function neighbours(id: number): [number, number, number] {
  const [x, y, q] = triOf(id);
  const out = q === 0 ? triId(x, y - 1, 2) : q === 1 ? triId(x + 1, y, 3) : q === 2 ? triId(x, y + 1, 0) : triId(x - 1, y, 1);
  return [out, triId(x, y, (q + 1) % 4), triId(x, y, (q + 3) % 4)];
}
const EDGE_LEN = [1, Math.SQRT1_2, Math.SQRT1_2];

function inside(poly: Pt[], [px, py]: Pt) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Tris inside a polygon with lattice corners. */
export function polyTris(poly: Pt[]): number[] {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const out: number[] = [];
  for (let x = Math.floor(Math.min(...xs)); x < Math.max(...xs); x++)
    for (let y = Math.floor(Math.min(...ys)); y < Math.max(...ys); y++)
      for (let q = 0; q < 4; q++) {
        const id = triId(x, y, q);
        if (inside(poly, centroid(id))) out.push(id);
      }
  return out.sort((a, b) => a - b);
}

// ── Turning and flipping ─────────────────────────────────────────────────

/** Flip (mirror left–right) first, then k quarter turns clockwise on screen. */
export function turnPt([x, y]: Pt, k: number, flip: boolean): Pt {
  let p: Pt = flip ? [-x, y] : [x, y];
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) p = [-p[1], p[0]];
  return p;
}

/** Smallest cell corner of a set of tris. */
function minCell(ids: number[]): Pt {
  let mx = Infinity;
  let my = Infinity;
  for (const id of ids) {
    const [x, y] = triOf(id);
    if (x < mx) mx = x;
    if (y < my) my = y;
  }
  return [mx, my];
}

export function normalize(ids: number[]): { tris: number[]; shift: Pt } {
  const [mx, my] = minCell(ids);
  return { tris: ids.map((id) => shiftId(id, -mx, -my)).sort((a, b) => a - b), shift: [-mx, -my] };
}

export function turnTris(ids: number[], k: number, flip: boolean) {
  return ids.map((id) => {
    const [px, py] = turnPt(centroid(id), k, flip);
    return triAt(px, py);
  });
}

export const keyOf = (ids: number[]) => ids.join(",");

/** The same key for a shape however it is turned (and flipped, if allowed). */
export function shapeKey(ids: number[], allowFlip = true) {
  let best = "";
  for (const flip of allowFlip ? [false, true] : [false])
    for (let k = 0; k < 4; k++) {
      const key = keyOf(normalize(turnTris(ids, k, flip)).tris);
      if (!best || key < best) best = key;
    }
  return best;
}

// ── Pieces ───────────────────────────────────────────────────────────────

export type PieceKind = "bigTri" | "midTri" | "smallTri" | "square" | "para" | "unit" | "half" | "domino" | "trap" | "ell" | "bigSquare";

export const PIECES: Record<PieceKind, { name: string; poly: Pt[] }> = {
  bigTri: { name: "مثلث بزرگ", poly: [[0, 0], [4, 0], [2, 2]] },
  midTri: { name: "مثلث متوسط", poly: [[0, 0], [2, 0], [0, 2]] },
  smallTri: { name: "مثلث کوچک", poly: [[0, 0], [2, 0], [1, 1]] },
  square: { name: "مربع کج", poly: [[1, 0], [2, 1], [1, 2], [0, 1]] },
  para: { name: "متوازی‌الاضلاع", poly: [[0, 0], [2, 0], [3, 1], [1, 1]] },
  unit: { name: "مربع کوچک", poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  half: { name: "نیم‌مربع", poly: [[0, 0], [1, 0], [0, 1]] },
  domino: { name: "مستطیل", poly: [[0, 0], [2, 0], [2, 1], [0, 1]] },
  trap: { name: "ذوزنقه", poly: [[0, 0], [3, 0], [2, 1], [1, 1]] },
  ell: { name: "ال", poly: [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]] },
  bigSquare: { name: "مربع بزرگ", poly: [[0, 0], [2, 0], [2, 2], [0, 2]] },
};

export const TANGRAM: PieceKind[] = ["bigTri", "bigTri", "midTri", "smallTri", "smallTri", "square", "para"];

export interface Orient {
  k: number;
  flip: boolean;
  /** Tris with the smallest cell at (0, 0). */
  tris: number[];
  /** Added after turning to bring the smallest cell to (0, 0). */
  shift: Pt;
}

const orientMemo = new Map<string, Orient[]>();
/** The different ways a piece can lie. */
export function orients(kind: PieceKind, allowFlip: boolean): Orient[] {
  const memoKey = `${kind}-${allowFlip}`;
  const hit = orientMemo.get(memoKey);
  if (hit) return hit;
  const base = polyTris(PIECES[kind].poly);
  const seen = new Set<string>();
  const out: Orient[] = [];
  for (const flip of allowFlip ? [false, true] : [false])
    for (let k = 0; k < 4; k++) {
      const { tris, shift } = normalize(turnTris(base, k, flip));
      const key = keyOf(tris);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ k, flip, tris, shift });
    }
  orientMemo.set(memoKey, out);
  return out;
}

export const areaOf = (kind: PieceKind) => orients(kind, false)[0].tris.length;

/** A piece on the lattice. */
export interface Placement {
  kind: PieceKind;
  k: number;
  flip: boolean;
  /** Where the piece's own (0, 0) lands. */
  x: number;
  y: number;
}

/** Tris covered by a placement. */
export function placedTris(p: Placement): number[] {
  // Orientation tris were moved by `shift`; the placement moves the turned piece by (x, y).
  const o = orientFor(p.kind, p.k, p.flip);
  return o.tris.map((id) => shiftId(id, p.x - o.shift[0], p.y - o.shift[1]));
}

const orientForMemo = new Map<string, Orient>();
function orientFor(kind: PieceKind, k: number, flip: boolean): Orient {
  const key = `${kind}${k}${flip}`;
  let o = orientForMemo.get(key);
  if (!o) {
    const { tris, shift } = normalize(turnTris(polyTris(PIECES[kind].poly), k, flip));
    o = { k, flip, tris, shift };
    orientForMemo.set(key, o);
  }
  return o;
}

/** Placement of an orientation moved by a whole number of cells. */
const placement = (kind: PieceKind, o: Orient, dx: number, dy: number): Placement => ({ kind, k: o.k, flip: o.flip, x: dx + o.shift[0], y: dy + o.shift[1] });

/** Corners of a placed piece. */
export const placedPoly = (p: Placement): Pt[] => PIECES[p.kind].poly.map((v) => {
  const [x, y] = turnPt(v, p.k, p.flip);
  return [x + p.x, y + p.y];
});

// ── Solver ───────────────────────────────────────────────────────────────

/** Ways to cover the target exactly with the pieces (each used once). */
export function solve(target: number[], kinds: PieceKind[], allowFlip: boolean, limit = 1): Placement[][] {
  const area = kinds.reduce((s, k) => s + areaOf(k), 0);
  if (area !== target.length) return [];
  const want = new Set(target);
  const order = [...target].sort((a, b) => a - b);
  const covered = new Set<number>();
  const counts = new Map<PieceKind, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  const out: Placement[][] = [];
  const path: Placement[] = [];

  const go = (from: number): boolean => {
    let i = from;
    while (i < order.length && covered.has(order[i])) i++;
    if (i === order.length) {
      out.push([...path]);
      return out.length >= limit;
    }
    const t = order[i];
    const [tx, ty, tq] = triOf(t);
    for (const [kind, n] of counts) {
      if (!n) continue;
      for (const o of orients(kind, allowFlip))
        for (const a of o.tris) {
          if ((a & 3) !== tq) continue;
          const [ax, ay] = triOf(a);
          const [dx, dy] = [tx - ax, ty - ay];
          const ids = o.tris.map((id) => shiftId(id, dx, dy));
          if (!ids.every((id) => want.has(id) && !covered.has(id))) continue;
          for (const id of ids) covered.add(id);
          counts.set(kind, n - 1);
          path.push(placement(kind, o, dx, dy));
          if (go(i + 1)) return true;
          path.pop();
          counts.set(kind, n);
          for (const id of ids) covered.delete(id);
        }
    }
    return false;
  };
  go(0);
  return out;
}

const solveMemo = new Map<string, Placement[] | null>();
export function solveOnce(target: number[], kinds: PieceKind[], allowFlip: boolean): Placement[] | null {
  const key = `${keyOf([...target].sort((a, b) => a - b))}|${[...kinds].sort().join()}|${allowFlip}`;
  if (solveMemo.has(key)) return solveMemo.get(key)!;
  const s = solve(target, kinds, allowFlip, 1)[0] ?? null;
  if (solveMemo.size > 5000) solveMemo.clear();
  solveMemo.set(key, s);
  return s;
}

// ── Shapes ───────────────────────────────────────────────────────────────

/** Length of the outline. */
export function perimeter(ids: number[]) {
  const set = new Set(ids);
  let p = 0;
  for (const id of ids) neighbours(id).forEach((n, i) => !set.has(n) && (p += EDGE_LEN[i]));
  return p;
}

/** True if the shape is one piece with no holes. */
export function isSolid(ids: number[]) {
  const set = new Set(ids);
  const flood = (start: number, ok: (id: number) => boolean) => {
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length)
      for (const n of neighbours(stack.pop()!))
        if (!seen.has(n) && ok(n)) {
          seen.add(n);
          stack.push(n);
        }
    return seen;
  };
  if (flood(ids[0], (n) => set.has(n)).size !== ids.length) return false;
  // Every empty tri in the box (one cell wider) reaches the edge of the box.
  const cells = ids.map(triOf);
  const [x0, x1] = [Math.min(...cells.map((c) => c[0])) - 1, Math.max(...cells.map((c) => c[0])) + 1];
  const [y0, y1] = [Math.min(...cells.map((c) => c[1])) - 1, Math.max(...cells.map((c) => c[1])) + 1];
  const inBox = (id: number) => {
    const [x, y] = triOf(id);
    return x >= x0 && x <= x1 && y >= y0 && y <= y1 && !set.has(id);
  };
  const empty = (x1 - x0 + 1) * (y1 - y0 + 1) * 4 - ids.length;
  return flood(triId(x0, y0, 0), inBox).size === empty;
}

/** Outline loops of a shape, as corner lists (straight runs merged). */
export function outline(ids: number[]): Pt[][] {
  const set = new Set(ids);
  const k = ([x, y]: Pt) => `${Math.round(x * 2)},${Math.round(y * 2)}`;
  const next = new Map<string, Pt[]>();
  for (const id of ids) {
    const c = triCorners(id);
    const nb = neighbours(id);
    // Edges: c0→c1 is the cell side (nb[0]); c1→centre borders q+1 (nb[1]); centre→c0 borders q−1 (nb[2]).
    const edges: [Pt, Pt, number][] = [
      [c[0], c[1], nb[0]],
      [c[1], c[2], nb[1]],
      [c[2], c[0], nb[2]],
    ];
    for (const [a, b, n] of edges) if (!set.has(n)) next.set(k(a), [...(next.get(k(a)) ?? []), b]);
  }
  const loops: Pt[][] = [];
  for (;;) {
    const startKey = [...next.keys()].find((key) => next.get(key)!.length);
    if (!startKey) break;
    const [sx, sy] = startKey.split(",").map((v) => Number(v) / 2);
    const loop: Pt[] = [[sx, sy]];
    let cur = startKey;
    for (;;) {
      const outs = next.get(cur)!;
      const b = outs.shift()!;
      cur = k(b);
      if (cur === startKey) break;
      loop.push(b);
    }
    // Merge straight runs.
    const merged = loop.filter((p, i) => {
      const a = loop[(i + loop.length - 1) % loop.length];
      const b = loop[(i + 1) % loop.length];
      return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9;
    });
    loops.push(merged);
  }
  return loops;
}

/** Bounding box of a shape: [x0, y0, x1, y1]. */
export function boxOf(ids: number[]): [number, number, number, number] {
  const pts = ids.flatMap(triCorners);
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}

/**
 * Pieces put together edge to edge into a compact shape with no holes.
 * Each next piece goes where the outline grows least (with a little chance).
 */
export function assemble(rng: Rng, kinds: PieceKind[], allowFlip: boolean): Placement[] | null {
  for (let attempt = 0; attempt < 30; attempt++) {
    const first = pick(rng, orients(kinds[0], allowFlip));
    const placed: Placement[] = [placement(kinds[0], first, 0, 0)];
    const union = new Set(first.tris);
    let ok = true;
    for (const kind of kinds.slice(1)) {
      const empties = new Set<number>();
      for (const id of union) for (const n of neighbours(id)) if (!union.has(n)) empties.add(n);
      const cands: { p: Placement; ids: number[]; d: number }[] = [];
      const seen = new Set<string>();
      for (const o of orients(kind, allowFlip))
        for (const e of empties) {
          const [ex, ey, eq] = triOf(e);
          for (const a of o.tris) {
            if ((a & 3) !== eq) continue;
            const [ax, ay] = triOf(a);
            const [dx, dy] = [ex - ax, ey - ay];
            const key = `${o.k}${o.flip}${dx},${dy}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const ids = o.tris.map((id) => shiftId(id, dx, dy));
            if (ids.some((id) => union.has(id))) continue;
            const mine = new Set(ids);
            let d = 0;
            for (const id of ids) neighbours(id).forEach((n, i) => !mine.has(n) && (d += union.has(n) ? -EDGE_LEN[i] : EDGE_LEN[i]));
            cands.push({ p: placement(kind, o, dx, dy), ids, d });
          }
        }
      if (!cands.length) {
        ok = false;
        break;
      }
      const best = Math.min(...cands.map((c) => c.d));
      const c = pick(rng, cands.filter((c) => c.d <= best + 0.75));
      placed.push(c.p);
      for (const id of c.ids) union.add(id);
    }
    if (ok && isSolid([...union])) return placed;
  }
  return null;
}

export const unionOf = (ps: Placement[]) => ps.flatMap(placedTris).sort((a, b) => a - b);

// ── Tangram figures ──────────────────────────────────────────────────────

/** Figures the seven tangram pieces make on this lattice (the tests check each with the solver). */
export const FIGURES: { name: string; poly: Pt[] }[] = [
  { name: "مربع", poly: [[0, 0], [4, 0], [4, 4], [0, 4]] },
  { name: "مثلث", poly: [[0, 0], [8, 0], [4, 4]] },
  { name: "متوازی‌الاضلاع", poly: [[0, 0], [4, 0], [8, 4], [4, 4]] },
  { name: "شش‌ضلعی", poly: [[0, 2], [2, 0], [4, 0], [6, 2], [4, 4], [2, 4]] },
  { name: "قایق", poly: [[0, 2], [2, 2], [4, 0], [6, 2], [8, 2], [6, 4], [2, 4]] },
  { name: "ذوزنقه", poly: [[0, 0], [6, 0], [2, 4], [0, 4]] },
  { name: "پیکان", poly: [[0, 2], [2, 0], [6, 0], [4, 2], [6, 4], [2, 4]] },
];

/** The figures the tangram really makes (some of the list above may not). */
let figuresMemo: typeof FIGURES | null = null;
export const tangramFigures = () => (figuresMemo ??= FIGURES.filter((f) => solveOnce(polyTris(f.poly), TANGRAM, true) !== null));

// ── Questions ────────────────────────────────────────────────────────────

export type PuzzleQuestionType = "build" | "overlay" | "combine" | "split" | "extra" | "complete";

interface Base {
  level: Level;
  seed: number;
}

/** Build the shadow with the pieces. Any covering counts; `solution` is one. */
export interface BuildQuestion extends Base {
  type: "build";
  kinds: PieceKind[];
  target: number[];
  solution: Placement[];
  guides: boolean;
  allowFlip: boolean;
  name?: string;
}

export type OverlayTag = "right" | "noTurn" | "otherTurn" | "overlap" | "xor" | "missed";

/** Two see-through sheets, the second turned or flipped first; which picture do they make? */
export interface OverlayQuestion extends Base {
  type: "overlay";
  n: number;
  a: number[];
  b: number[];
  /** What happens to sheet B first: nothing, a quarter turn clockwise, or flipped over (left–right). */
  move: "none" | "turn" | "flip";
  options: number[][];
  tags: OverlayTag[];
  answer: number;
}

export type ShapeTag = "right" | "notMade" | "shape" | "size" | "mirror" | "used";

/** Which shape can the two pieces make? */
export interface CombineQuestion extends Base {
  type: "combine";
  pieces: [PieceKind, PieceKind];
  options: number[][];
  tags: ShapeTag[];
  answer: number;
  /** The two pieces making the right option, as drawn. */
  solution: Placement[];
}

/** Which set of pieces makes the shape? */
export interface SplitQuestion extends Base {
  type: "split";
  target: number[];
  options: PieceKind[][];
  answer: number;
  solution: Placement[];
}

/** Which piece is not needed? */
export interface ExtraQuestion extends Base {
  type: "extra";
  target: number[];
  pieces: PieceKind[];
  answer: number;
  solution: Placement[];
}

/** Which piece fills the gap? (slide and turn, no flipping) */
export interface CompleteQuestion extends Base {
  type: "complete";
  target: number[];
  hole: number[];
  options: { kind: PieceKind; k: number; flip: boolean }[];
  tags: ShapeTag[];
  answer: number;
  /** The right piece in the gap. */
  fill: Placement;
}

export type PuzzleQuestion = BuildQuestion | OverlayQuestion | CombineQuestion | SplitQuestion | ExtraQuestion | CompleteQuestion;

const SIMPLE: PieceKind[] = ["unit", "half", "smallTri", "midTri", "square", "domino", "trap"];
const MORE: PieceKind[] = [...SIMPLE, "para", "ell", "bigTri", "bigSquare"];
/** Pieces whose mirror image is not a turn of them. */
const CHIRAL: PieceKind[] = ["para"];

/** Pieces with the same area as this one but another shape. */
const sameArea = (kind: PieceKind, pool: PieceKind[]) => pool.filter((k) => k !== kind && areaOf(k) === areaOf(kind));

function pickKinds(rng: Rng, n: number, pool: PieceKind[]) {
  // Mostly different pieces; the odd repeat is fine.
  const out: PieceKind[] = [];
  while (out.length < n) {
    const k = pick(rng, pool);
    if (out.filter((x) => x === k).length < (rng() < 0.3 ? 2 : 1)) out.push(k);
  }
  return out;
}

/** Turned (and flipped) at random, then moved so the smallest cell is (0, 0). */
function randomTurn(rng: Rng, ids: number[], allowFlip: boolean) {
  return normalize(turnTris(ids, randInt(rng, 4), allowFlip && rng() < 0.5)).tris;
}

function buildQuestion(rng: Rng, level: Level, seed: number): BuildQuestion {
  if (level === 3) {
    const figs = tangramFigures();
    const fig = pick(rng, figs);
    const flip = rng() < 0.5;
    const target = normalize(turnTris(polyTris(fig.poly), randInt(rng, 4), flip)).tris;
    return { type: "build", level, seed, kinds: [...TANGRAM], target, solution: solveOnce(target, TANGRAM, true)!, guides: false, allowFlip: true, name: fig.name };
  }
  const n = level === 1 ? 3 : 5;
  const allowFlip = level > 1;
  for (;;) {
    const kinds = pickKinds(rng, n, level === 1 ? SIMPLE.filter((k) => k !== "half") : MORE);
    const placed = assemble(rng, kinds, allowFlip);
    if (!placed) continue;
    const { tris, shift } = normalize(unionOf(placed));
    const solution = placed.map((p) => ({ ...p, x: p.x + shift[0], y: p.y + shift[1] }));
    return { type: "build", level, seed, kinds: shuffle(rng, kinds), target: tris, solution, guides: level === 1, allowFlip };
  }
}

// Overlay sheets: cells r·n + c.
export function moveCells(cells: number[], n: number, move: OverlayQuestion["move"] | "turnBack" | "flipDown"): number[] {
  return cells
    .map((i) => {
      const [r, c] = [Math.floor(i / n), i % n];
      switch (move) {
        case "turn":
          return c * n + (n - 1 - r);
        case "turnBack":
          return (n - 1 - c) * n + r;
        case "flip":
          return r * n + (n - 1 - c);
        case "flipDown":
          return (n - 1 - r) * n + c;
        default:
          return i;
      }
    })
    .sort((a, b) => a - b);
}

const cellsKey = (c: number[]) => [...c].sort((a, b) => a - b).join(",");

function overlayQuestion(rng: Rng, level: Level, seed: number): OverlayQuestion {
  const n = level === 1 ? 3 : 4;
  const move: OverlayQuestion["move"] = level === 1 ? "none" : level === 2 ? "turn" : "flip";
  for (;;) {
    const count = level === 1 ? 3 : 4 + randInt(rng, 2);
    const a = shuffle(rng, Array.from({ length: n * n }, (_, i) => i)).slice(0, count).sort((x, y) => x - y);
    const b = shuffle(rng, Array.from({ length: n * n }, (_, i) => i)).slice(0, count).sort((x, y) => x - y);
    const tb = moveCells(b, n, move);
    if (move !== "none" && cellsKey(tb) === cellsKey(b)) continue;
    const both = a.filter((i) => tb.includes(i));
    if (!both.length) continue;
    const union = [...new Set([...a, ...tb])].sort((x, y) => x - y);
    if (union.length === n * n) continue;
    const cands: [OverlayTag, number[]][] = [
      ["right", union],
      ...(move !== "none" ? [["noTurn", [...new Set([...a, ...b])]] as [OverlayTag, number[]]] : []),
      ...(move !== "none" ? [["otherTurn", [...new Set([...a, ...moveCells(b, n, move === "turn" ? "turnBack" : "flipDown")])]] as [OverlayTag, number[]]] : []),
      ["xor", union.filter((i) => !both.includes(i))],
      ...(both.length > 1 ? [["overlap", both] as [OverlayTag, number[]]] : []),
      ...shuffle(rng, tb.filter((i) => !a.includes(i))).map((i) => ["missed", union.filter((j) => j !== i)] as [OverlayTag, number[]]),
    ];
    const seen = new Set<string>();
    const kept: [OverlayTag, number[]][] = [];
    for (const [tag, cells] of cands) {
      const key = cellsKey(cells);
      if (seen.has(key) || !cells.length) continue;
      seen.add(key);
      kept.push([tag, cells.sort((x, y) => x - y)]);
      if (kept.length === 4) break;
    }
    if (kept.length < 4) continue;
    const order = shuffle(rng, kept);
    return { type: "overlay", level, seed, n, a, b, move, options: order.map((o) => o[1]), tags: order.map((o) => o[0]), answer: order.findIndex((o) => o[0] === "right") };
  }
}

/** Every shape two pieces make edge to edge (one turned and flipped any way), by shape key. */
function pairShapes(a: PieceKind, b: PieceKind): Map<string, Placement[]> {
  const out = new Map<string, Placement[]>();
  const oa = orients(a, false)[0];
  const ua = new Set(oa.tris);
  const pa = placement(a, oa, 0, 0);
  const empties = new Set<number>();
  for (const id of oa.tris) for (const n of neighbours(id)) if (!ua.has(n)) empties.add(n);
  for (const o of orients(b, true))
    for (const e of empties) {
      const [ex, ey, eq] = triOf(e);
      for (const t of o.tris) {
        if ((t & 3) !== eq) continue;
        const [tx, ty] = triOf(t);
        const ids = o.tris.map((id) => shiftId(id, ex - tx, ey - ty));
        if (ids.some((id) => ua.has(id))) continue;
        const all = [...oa.tris, ...ids];
        if (!isSolid(all)) continue;
        const key = shapeKey(all);
        if (!out.has(key)) out.set(key, [pa, placement(b, o, ex - tx, ey - ty)]);
      }
    }
  return out;
}

const pairMemo = new Map<string, Map<string, Placement[]>>();
function pairShapesMemo(a: PieceKind, b: PieceKind) {
  const key = `${a}+${b}`;
  if (!pairMemo.has(key)) pairMemo.set(key, pairShapes(a, b));
  return pairMemo.get(key)!;
}

const tidy = (ids: number[]) => perimeter(ids) / Math.sqrt(ids.length);

function combineQuestion(rng: Rng, level: Level, seed: number): CombineQuestion {
  const pool: PieceKind[] = level === 1 ? ["half", "unit", "smallTri", "midTri"] : level === 2 ? ["half", "unit", "smallTri", "midTri", "square", "domino", "trap"] : ["smallTri", "midTri", "square", "para", "trap", "domino", "ell"];
  for (;;) {
    const a = pick(rng, pool);
    const b = pick(rng, pool);
    const made = pairShapesMemo(a, b);
    if (made.size < 2) continue;
    // The right option: one of the tidier shapes.
    const shapes = [...made.entries()].map(([key, ps]) => ({ key, ps, ids: unionOf(ps) })).sort((x, y) => tidy(x.ids) - tidy(y.ids));
    const right = pick(rng, shapes.slice(0, Math.min(4, shapes.length)));
    // Wrong options: tidy shapes from a swapped piece of the same area, that these two cannot make.
    const wrong: { ids: number[]; tag: ShapeTag }[] = [];
    const keys = new Set([right.key]);
    const swaps = shuffle(rng, [...sameArea(a, MORE).map((x) => [x, b] as [PieceKind, PieceKind]), ...sameArea(b, MORE).map((x) => [a, x] as [PieceKind, PieceKind])]);
    for (const [x, y] of swaps) {
      const others = [...pairShapesMemo(x, y).entries()].filter(([key]) => !made.has(key) && !keys.has(key)).map(([key, ps]) => ({ key, ids: unionOf(ps) }));
      others.sort((p, q) => tidy(p.ids) - tidy(q.ids));
      const o = others.slice(0, 3)[randInt(rng, Math.min(3, others.length))];
      if (!o) continue;
      keys.add(o.key);
      wrong.push({ ids: o.ids, tag: "notMade" });
      if (wrong.length === 3) break;
    }
    if (wrong.length < 3) continue;
    const opts = shuffle(rng, [{ ids: right.ids, tag: "right" as ShapeTag }, ...wrong]);
    const answer = opts.findIndex((o) => o.tag === "right");
    // Draw every option turned at random; carry the right one's pieces along.
    const k = level === 1 ? 0 : randInt(rng, 4);
    const flip = level === 3 && rng() < 0.5;
    const options = opts.map((o, i) => (i === answer ? o.ids : randomTurn(rng, o.ids, level === 3)));
    const turned = turnTris(right.ids, k, flip);
    const { shift } = normalize(turned);
    options[answer] = normalize(turned).tris;
    const solution = right.ps.map((p) => {
      const [x, y] = turnPt([p.x, p.y], k, flip);
      // Turning a piece's frame: its turn adds k, a flip mirrors the turn.
      return { kind: p.kind, k: flip ? (k - p.k + 4) % 4 : (p.k + k) % 4, flip: p.flip !== flip, x: x + shift[0], y: y + shift[1] };
    });
    return { type: "combine", level, seed, pieces: [a, b], options, tags: opts.map((o) => o.tag), answer, solution };
  }
}

const multiKey = (ks: PieceKind[]) => [...ks].sort().join(",");

function splitQuestion(rng: Rng, level: Level, seed: number): SplitQuestion {
  const n = level + 1;
  const pool = level === 1 ? SIMPLE : MORE;
  for (;;) {
    const kinds = pickKinds(rng, n, pool);
    const placed = assemble(rng, kinds, true);
    if (!placed) continue;
    const { tris, shift } = normalize(unionOf(placed));
    const wrong: PieceKind[][] = [];
    const seen = new Set([multiKey(kinds)]);
    for (let tries = 0; tries < 40 && wrong.length < 3; tries++) {
      const i = randInt(rng, n);
      const alts = sameArea(kinds[i], pool);
      if (!alts.length) continue;
      const set = kinds.map((k, j) => (j === i ? pick(rng, alts) : k));
      const key = multiKey(set);
      if (seen.has(key)) continue;
      seen.add(key);
      if (solveOnce(tris, set, true)) continue;
      wrong.push(set);
    }
    if (wrong.length < 3) continue;
    const opts = shuffle(rng, [kinds, ...wrong].map((ks) => shuffle(rng, ks)));
    const answer = opts.findIndex((ks) => multiKey(ks) === multiKey(kinds));
    const solution = placed.map((p) => ({ ...p, x: p.x + shift[0], y: p.y + shift[1] }));
    return { type: "split", level, seed, target: tris, options: opts, answer, solution };
  }
}

function extraQuestion(rng: Rng, level: Level, seed: number): ExtraQuestion {
  const n = level + 2;
  const pool = level === 1 ? SIMPLE : MORE;
  for (;;) {
    const kinds = pickKinds(rng, n, pool);
    const placed = assemble(rng, kinds, true);
    if (!placed) continue;
    const { tris, shift } = normalize(unionOf(placed));
    // The extra piece has the same area as one that is used, so area alone does not tell.
    const twin = pick(rng, kinds);
    const alts = sameArea(twin, pool).filter((k) => !kinds.includes(k));
    if (!alts.length) continue;
    const extra = pick(rng, alts);
    const pieces = shuffle(rng, [...kinds, extra]);
    const answer = pieces.indexOf(extra);
    // Only leaving out the extra piece works.
    let unique = true;
    for (let i = 0; i < pieces.length && unique; i++) {
      if (i === answer || pieces[i] === extra) continue;
      if (solveOnce(tris, pieces.filter((_, j) => j !== i), true)) unique = false;
    }
    if (!unique) continue;
    const solution = placed.map((p) => ({ ...p, x: p.x + shift[0], y: p.y + shift[1] }));
    return { type: "extra", level, seed, target: tris, pieces, answer, solution };
  }
}

/** Can this piece fill the hole by sliding and turning (no flipping)? */
const fits = (kind: PieceKind, hole: number[]) => solveOnce(hole, [kind], false) !== null;

function completeQuestion(rng: Rng, level: Level, seed: number): CompleteQuestion {
  const n = level + 2;
  const pool = level === 1 ? SIMPLE : MORE;
  for (;;) {
    const kinds = pickKinds(rng, n, pool);
    const placed = assemble(rng, kinds, false);
    if (!placed) continue;
    const { tris, shift } = normalize(unionOf(placed));
    const moved = placed.map((p) => ({ ...p, x: p.x + shift[0], y: p.y + shift[1] }));
    const gap = pick(rng, moved);
    const hole = placedTris(gap).sort((a, b) => a - b);
    const rest = tris.filter((id) => !hole.includes(id));
    if (!isSolid(rest)) continue;
    // Options: the right piece (turned past level 1), and pieces that do not fit.
    const turn = (kind: PieceKind) => ({ kind, k: level === 1 ? gap.k : randInt(rng, 4), flip: false });
    const opts: { kind: PieceKind; k: number; flip: boolean; tag: ShapeTag }[] = [{ ...turn(gap.kind), tag: "right" }];
    if (level === 3 && CHIRAL.includes(gap.kind)) opts.push({ kind: gap.kind, k: randInt(rng, 4), flip: true, tag: "mirror" });
    for (const k of shuffle(rng, sameArea(gap.kind, pool))) if (opts.length < 4 && !fits(k, hole)) opts.push({ ...turn(k), tag: "shape" });
    for (const k of shuffle(rng, pool.filter((k) => areaOf(k) !== areaOf(gap.kind)))) if (opts.length < 4) opts.push({ ...turn(k), tag: "size" });
    const order = shuffle(rng, opts);
    return {
      type: "complete",
      level,
      seed,
      target: tris,
      hole,
      options: order.map(({ kind, k, flip }) => ({ kind, k, flip })),
      tags: order.map((o) => o.tag),
      answer: order.findIndex((o) => o.tag === "right"),
      fill: gap,
    };
  }
}

export function makePuzzleQuestion(type: PuzzleQuestionType, level: Level, seed: number): PuzzleQuestion {
  const rng = mulberry32(seed * 11 + level * 211 + type.length * 17);
  switch (type) {
    case "build":
      return buildQuestion(rng, level, seed);
    case "overlay":
      return overlayQuestion(rng, level, seed);
    case "combine":
      return combineQuestion(rng, level, seed);
    case "split":
      return splitQuestion(rng, level, seed);
    case "extra":
      return extraQuestion(rng, level, seed);
    case "complete":
      return completeQuestion(rng, level, seed);
  }
}

/** Tris of an option piece in a "complete" question, as drawn. */
export const optionTris = (o: { kind: PieceKind; k: number; flip: boolean }) => normalize(turnTris(polyTris(PIECES[o.kind].poly), o.k, o.flip)).tris;
