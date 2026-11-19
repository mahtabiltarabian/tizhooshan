// Tool 16: geometry on a geoboard. Pegs sit at whole-number points (x, y),
// 0 ≤ x, y < n, with y growing downwards like the screen. A shape is the list
// of pegs a rubber band goes round. Areas may be halves; a perimeter is asked
// only of shapes whose sides run along the grid, since a slanted side is not
// a whole number of units long. Each question keeps its answer and the usual
// slips, so the feedback can say which slip a wrong answer was.

import { makeCircleQuestion, measureMistake, type CircleQuestion, type MeasureTag } from "./circle";
import { makeCompositeQuestion, type CompositeQuestion } from "./composite-area";
import { makeParallelQuestion, parallelMistake, type ParallelQuestion, type ParallelTag } from "./parallel-angles";
import { mulberry32, pick, randInt, type Rng } from "./random";

export type Level = 1 | 2 | 3;
/**
 * circle and composite: generators/circle.ts and generators/composite-area.ts (π = 3.14, lengths on a figure, not the geoboard).
 * parallel: generators/parallel-angles.ts (angles with parallel lines and a transversal).
 */
export type GeometryQuestionType = "area" | "perimeter" | "angle" | "classify" | "build" | "divide" | "circle" | "composite" | "parallel";
export type Pt = [number, number];

/** Pegs on each side of the board, by level. */
export const BOARD: Record<Level, number> = { 1: 6, 2: 7, 3: 8 };

// ── Lattice maths ────────────────────────────────────────────────────────

const gcd = (a: number, b: number) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
export const samePt = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const cross = (u: Pt, v: Pt) => u[0] * v[1] - u[1] * v[0];
const dot = (u: Pt, v: Pt) => u[0] * v[0] + u[1] * v[1];

/** Sides of a closed band, each as [from, to]. */
export const edgesOf = (poly: Pt[]): [Pt, Pt][] => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);

/** Twice the signed area (shoelace). A whole number for pegs. */
export const area2 = (poly: Pt[]) => edgesOf(poly).reduce((s, [a, b]) => s + cross(a, b), 0);
export const areaOf = (poly: Pt[]) => Math.abs(area2(poly)) / 2;

/** Every side along a grid line. */
export const isRectilinear = (poly: Pt[]) => edgesOf(poly).every(([a, b]) => a[0] === b[0] || a[1] === b[1]);
/** Every side along a grid line or a square's diagonal. */
export const isGridOrDiagonal = (poly: Pt[]) => edgesOf(poly).every(([a, b]) => a[0] === b[0] || a[1] === b[1] || Math.abs(a[0] - b[0]) === Math.abs(a[1] - b[1]));

/** Perimeter in units, only when every side runs along the grid. */
export const perimeterOf = (poly: Pt[]) => (isRectilinear(poly) ? edgesOf(poly).reduce((s, [a, b]) => s + Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 0) : null);

/** Pegs the band touches (on its sides). */
export const boundaryPegs = (poly: Pt[]) => edgesOf(poly).reduce((s, [a, b]) => s + gcd(b[0] - a[0], b[1] - a[1]), 0);
/** Pegs strictly inside, by Pick's theorem: A = I + B/2 − 1. */
export const insidePegs = (poly: Pt[]) => areaOf(poly) - boundaryPegs(poly) / 2 + 1;

export function boxOf(poly: Pt[]) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/** Peg c on the closed segment ab. */
function onSegment(a: Pt, b: Pt, c: Pt) {
  return cross(sub(b, a), sub(c, a)) === 0 && Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
}

/** Closed segments meet (crossing, touching or overlapping). */
function segmentsMeet(p1: Pt, p2: Pt, q1: Pt, q2: Pt) {
  const d1 = cross(sub(q2, q1), sub(p1, q1));
  const d2 = cross(sub(q2, q1), sub(p2, q1));
  const d3 = cross(sub(p2, p1), sub(q1, p1));
  const d4 = cross(sub(p2, p1), sub(q2, p1));
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return onSegment(q1, q2, p1) || onSegment(q1, q2, p2) || onSegment(p1, p2, q1) || onSegment(p1, p2, q2);
}

export type BandProblem = "few" | "repeat" | "flat" | "crossing";

/** Why a band is not a proper shape, or null if it is. */
export function bandProblem(poly: Pt[]): BandProblem | null {
  const n = poly.length;
  if (n < 3) return "few";
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (samePt(poly[i], poly[j])) return "repeat";
  if (area2(poly) === 0) return "flat";
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const [a1, a2] = [poly[i], poly[(i + 1) % n]];
      const [b1, b2] = [poly[j], poly[(j + 1) % n]];
      if (j === i + 1 || (i === 0 && j === n - 1)) {
        // Neighbouring sides share one peg; they must not run back over each other.
        const [v, u, w] = j === i + 1 ? [a2, a1, b2] : [a1, a2, b1];
        if (cross(sub(u, v), sub(w, v)) === 0 && dot(sub(u, v), sub(w, v)) > 0) return "crossing";
      } else if (segmentsMeet(a1, a2, b1, b2)) return "crossing";
    }
  return null;
}

/** Drops pegs where the band runs straight on, so a 4-peg rectangle stays 4 pegs. */
export function simplify(poly: Pt[]): Pt[] {
  let out = poly;
  for (let changed = true; changed && out.length > 3; ) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const [p, v, q] = [out[(i + out.length - 1) % out.length], out[i], out[(i + 1) % out.length]];
      if (cross(sub(v, p), sub(q, v)) === 0) {
        out = out.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return out;
}

export type AngleKind = "acute" | "right" | "obtuse" | "straight" | "reflex";

/** Kind of the angle between two arms from one corner (exact, from whole numbers). */
export function armsKind(u: Pt, w: Pt): AngleKind {
  const d = dot(u, w);
  if (cross(u, w) === 0) return d < 0 ? "straight" : "acute";
  return d > 0 ? "acute" : d === 0 ? "right" : "obtuse";
}

const degrees = (u: Pt, w: Pt) => (Math.atan2(Math.abs(cross(u, w)), dot(u, w)) * 180) / Math.PI;

/** Inside angles of a proper band, in degrees, with their kinds. */
export function cornerAngles(poly: Pt[]): { deg: number; kind: AngleKind }[] {
  const s = Math.sign(area2(poly));
  return poly.map((v, i) => {
    const p = poly[(i + poly.length - 1) % poly.length];
    const q = poly[(i + 1) % poly.length];
    const turn = cross(sub(v, p), sub(q, v));
    const d = degrees(sub(p, v), sub(q, v));
    if (turn === 0) return { deg: 180, kind: "straight" };
    if (Math.sign(turn) === s) return { deg: d, kind: armsKind(sub(p, v), sub(q, v)) };
    return { deg: 360 - d, kind: "reflex" };
  });
}

/** The part of the shape inside the unit square at (x, y): clip the shape to it. */
export function cellPiece(poly: Pt[], x: number, y: number): [number, number][] {
  type F = [number, number];
  let pts: F[] = poly;
  const sides: [(p: F) => number, (a: F, b: F) => F][] = [
    [(p) => p[0] - x, (a, b) => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])]],
    [(p) => x + 1 - p[0], (a, b) => [x + 1, a[1] + ((b[1] - a[1]) * (x + 1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] - y, (a, b) => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y]],
    [(p) => y + 1 - p[1], (a, b) => [a[0] + ((b[0] - a[0]) * (y + 1 - a[1])) / (b[1] - a[1]), y + 1]],
  ];
  for (const [inside, cut] of sides) {
    const out: F[] = [];
    pts.forEach((b, i) => {
      const a = pts[(i + pts.length - 1) % pts.length];
      const [ia, ib] = [inside(a) >= 0, inside(b) >= 0];
      if (ib) {
        if (!ia) out.push(cut(a, b));
        out.push(b);
      } else if (ia) out.push(cut(a, b));
    });
    pts = out;
    if (!pts.length) return [];
  }
  return pts;
}

function cellArea(poly: Pt[], x: number, y: number) {
  const pts = cellPiece(poly, x, y);
  let s = 0;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - a[1] * b[0];
  });
  return Math.abs(s) / 2;
}

/** How much of each grid square the shape covers (only squares it touches). */
export function cellCover(poly: Pt[]): { x: number; y: number; c: number }[] {
  const b = boxOf(poly);
  const out: { x: number; y: number; c: number }[] = [];
  for (let y = b.y0; y < b.y1; y++)
    for (let x = b.x0; x < b.x1; x++) {
      const c = Math.round(cellArea(poly, x, y) * 1e9) / 1e9;
      if (c > 0) out.push({ x, y, c });
    }
  return out;
}

/** Whole and half squares of a shape with sides along the grid or diagonals. */
export function squareCount(poly: Pt[]) {
  const cells = cellCover(poly);
  return { whole: cells.filter((c) => c.c === 1), half: cells.filter((c) => c.c === 0.5), other: cells.filter((c) => c.c !== 1 && c.c !== 0.5) };
}

/** A right-angled corner piece between a side and the bounding rectangle. */
export interface Piece {
  /** Its corners: one end of the side, the rectangle's corner, the other end. */
  tri: [Pt, Pt, Pt];
  /** Legs along the rectangle (area = a × b ÷ 2). */
  a: number;
  b: number;
}

/**
 * The bounding-rectangle method: when every peg of the band is on the
 * rectangle round it, and between two neighbouring pegs the rectangle turns
 * at most one corner, the shape is the rectangle minus right triangles.
 */
export function boxPieces(poly: Pt[]): Piece[] | null {
  const bx = boxOf(poly);
  const { x0, y0, x1, y1, w: W, h: H } = bx;
  if (!W || !H) return null;
  const P = 2 * (W + H);
  const tOf = (p: Pt) => (p[1] === y0 ? p[0] - x0 : p[0] === x1 ? W + p[1] - y0 : p[1] === y1 ? W + H + x1 - p[0] : p[0] === x0 ? 2 * W + H + y1 - p[1] : -1);
  let order = poly;
  let ts = order.map(tOf);
  if (ts.some((t) => t < 0)) return null;
  const descents = (t: number[]) => t.filter((v, i) => t[(i + 1) % t.length] <= v).length;
  if (descents(ts) !== 1) {
    order = [...poly].reverse();
    ts = order.map(tOf);
    if (descents(ts) !== 1) return null;
  }
  const corners: [number, Pt][] = [
    [0, [x0, y0]],
    [W, [x1, y0]],
    [W + H, [x1, y1]],
    [2 * W + H, [x0, y1]],
  ];
  const pieces: Piece[] = [];
  for (let i = 0; i < order.length; i++) {
    const [p, q] = [order[i], order[(i + 1) % order.length]];
    const len = (ts[(i + 1) % order.length] - ts[i] + P) % P;
    const inside = corners.filter(([t]) => {
      const d = (t - ts[i] + P) % P;
      return d > 0 && d < len;
    });
    if (inside.length > 1) return null;
    if (inside.length === 1) {
      const c = inside[0][1];
      pieces.push({ tri: [p, c, q], a: Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]), b: Math.abs(q[0] - c[0]) + Math.abs(q[1] - c[1]) });
    }
  }
  return pieces;
}

export type AreaMethod = "squares" | "box";

/** How "show me" counts this shape's area, or null if neither way fits. */
export function areaMethod(poly: Pt[]): AreaMethod | null {
  if (isGridOrDiagonal(poly)) return "squares";
  return boxPieces(poly) ? "box" : null;
}

/** Grid squares inside a shape that touch its band along a side (the "inner ring"). */
export function borderCells(poly: Pt[]) {
  const unit = new Set<string>();
  for (const [a, b] of edgesOf(poly)) {
    if (a[0] !== b[0] && a[1] !== b[1]) continue;
    const [dx, dy] = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
    for (let p: Pt = a; !samePt(p, b); p = [p[0] + dx, p[1] + dy]) {
      const q: Pt = [p[0] + dx, p[1] + dy];
      unit.add(`${Math.min(p[0], q[0])},${Math.min(p[1], q[1])},${dx ? "h" : "v"}`);
    }
  }
  return cellCover(poly).filter(({ x, y, c }) => c === 1 && (unit.has(`${x},${y},h`) || unit.has(`${x},${y + 1},h`) || unit.has(`${x},${y},v`) || unit.has(`${x + 1},${y},v`))).length;
}

/** Every peg on the band, with the side it lies on (a corner counts for the side it starts). */
export function bandPegs(poly: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const [a, b] of edgesOf(poly)) {
    const g = gcd(b[0] - a[0], b[1] - a[1]);
    for (let k = 0; k < g; k++) out.push([a[0] + ((b[0] - a[0]) / g) * k, a[1] + ((b[1] - a[1]) / g) * k]);
  }
  return out;
}

export const onBand = (poly: Pt[], p: Pt) => edgesOf(poly).some(([a, b]) => onSegment(a, b, p));
const sameSide = (poly: Pt[], p: Pt, q: Pt) => edgesOf(poly).some(([a, b]) => onSegment(a, b, p) && onSegment(a, b, q));

/**
 * Cut a convex shape with a straight band from peg p to peg q on its sides.
 * Returns the two parts' areas, or null if the band is not a cut.
 */
export function cutAreas(poly: Pt[], p: Pt, q: Pt): [number, number] | null {
  const parts = cutParts(poly, p, q);
  if (!parts) return null;
  const a = areaOf(parts[0]);
  return [a, areaOf(poly) - a];
}

/** The two parts of a convex shape cut from peg p to peg q, or null. */
export function cutParts(poly: Pt[], p: Pt, q: Pt): [Pt[], Pt[]] | null {
  if (samePt(p, q) || !onBand(poly, p) || !onBand(poly, q) || sameSide(poly, p, q)) return null;
  const n = poly.length;
  const sideOf = (r: Pt) => edgesOf(poly).findIndex(([a, b]) => onSegment(a, b, r) && !samePt(r, b));
  const [i, j] = [sideOf(p), sideOf(q)];
  const part: Pt[] = [p];
  for (let k = (i + 1) % n; ; k = (k + 1) % n) {
    part.push(poly[k]);
    if (k === j) break;
  }
  part.push(q);
  const other: Pt[] = [q];
  for (let k = (j + 1) % n; ; k = (k + 1) % n) {
    other.push(poly[k]);
    if (k === i) break;
  }
  other.push(p);
  return [part, other];
}

export const isConvex = (poly: Pt[]) => {
  const s = Math.sign(area2(poly));
  return poly.every((v, i) => Math.sign(cross(sub(v, poly[(i + poly.length - 1) % poly.length]), sub(poly[(i + 1) % poly.length], v))) === s);
};

/** All straight bands that cut a convex shape into two equal parts. */
export function halvingCuts(poly: Pt[]): [Pt, Pt][] {
  const pegs = bandPegs(poly);
  const total = areaOf(poly);
  const out: [Pt, Pt][] = [];
  for (let i = 0; i < pegs.length; i++)
    for (let j = i + 1; j < pegs.length; j++) {
      const parts = cutAreas(poly, pegs[i], pegs[j]);
      if (parts && parts[0] * 2 === total) out.push([pegs[i], pegs[j]]);
    }
  return out;
}

/** Rectangle: four corners, sides along the grid. */
export const isRect = (s: Pt[]) => s.length === 4 && isRectilinear(s);
/** Square in any direction: four equal sides at right angles. */
export function isSquare(s: Pt[]) {
  if (s.length !== 4) return false;
  const e = edgesOf(s).map(([a, b]) => sub(b, a));
  return e.every((v, i) => dot(v, v) === dot(e[0], e[0]) && dot(v, e[(i + 1) % 4]) === 0);
}

/**
 * Corners of a convex polygon with these inside angles (degrees, in order),
 * for drawing; y grows upwards here. Sides are chosen to look even. Null if
 * the angles cannot close up.
 */
export function anglePolygon(angles: number[]): [number, number][] | null {
  const n = angles.length;
  if (n < 3 || angles.some((a) => a <= 0 || a >= 180) || Math.abs(angles.reduce((s, a) => s + a, 0) - (n - 2) * 180) > 1e-9) return null;
  const heads: number[] = [0];
  for (let i = 1; i < n; i++) heads.push(heads[i - 1] + 180 - angles[i]);
  const dir = (h: number): [number, number] => [Math.cos((h * Math.PI) / 180), Math.sin((h * Math.PI) / 180)];
  let best: number[] | null = null;
  let bestSpread = Infinity;
  const choices = [1, 0.7, 1.4];
  // Vary at most four sides (3⁴ tries); the rest stay 1, which suits regular polygons.
  const free = Math.min(n - 2, 4);
  const combos = choices.length ** free;
  for (let c = 0; c < combos; c++) {
    const lens: number[] = Array<number>(n - 2).fill(1);
    for (let i = 0, k = c; i < free; i++, k = Math.floor(k / choices.length)) lens[i] = choices[k % choices.length];
    let [sx, sy] = [0, 0];
    lens.forEach((l, i) => {
      const [dx, dy] = dir(heads[i]);
      sx += l * dx;
      sy += l * dy;
    });
    // Solve a·u + b·v = −s for the last two sides.
    const [u, v] = [dir(heads[n - 2]), dir(heads[n - 1])];
    const det = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(det) < 1e-9) continue;
    const a = (-sx * v[1] + sy * v[0]) / det;
    const b = (-u[0] * sy + u[1] * sx) / det;
    const all = [...lens, a, b];
    const spread = Math.max(...all) / Math.min(...all);
    if (Math.min(a, b) > 0.3 && spread < bestSpread) [best, bestSpread] = [all, spread];
  }
  if (!best || bestSpread > 4) return null;
  const pts: [number, number][] = [[0, 0]];
  for (let i = 0; i < n - 1; i++) {
    const [dx, dy] = dir(heads[i]);
    const [x, y] = pts[i];
    pts.push([x + best[i] * dx, y + best[i] * dy]);
  }
  return pts.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
}

// ── Questions ────────────────────────────────────────────────────────────

interface Base {
  level: Level;
  seed: number;
  /** Pegs on each side of the board. */
  n: number;
}

export interface AreaQuestion extends Base {
  type: "area";
  poly: Pt[];
  answer: number;
}

export interface PerimeterQuestion extends Base {
  type: "perimeter";
  poly: Pt[];
  answer: number;
}

export type AngleVariant = "geo" | "triangle" | "isosceles" | "exterior" | "polygon" | "regular";

/**
 * geo: the angle between two bands on the board (multiples of 45°).
 * triangle: two angles given, find the third.
 * isosceles: apex given (find a base angle) or a base angle given (find the apex).
 * exterior: two inside angles given, find the outside angle at the third corner.
 * polygon: all angles but one given, find it.
 * regular: one inside angle of a regular polygon.
 */
export interface AngleQuestion extends Base {
  type: "angle";
  variant: AngleVariant;
  /** geo only: [end of arm 1, corner, end of arm 2]. */
  arms: Pt[];
  /** Inside angles of the figure, in order round it. */
  angles: number[];
  /** Corners whose angles are printed. */
  given: number[];
  /** The corner asked about (the exterior one for "exterior"; any for "regular"). */
  ask: number;
  answer: number;
}

/** Answer 0, 1, 2: acute, right, obtuse (the angle, or the triangle by its largest angle). */
export interface ClassifyQuestion extends Base {
  type: "classify";
  /** Level 1: [end of arm 1, corner, end of arm 2]; otherwise a triangle. */
  poly: Pt[];
  /** The corner that decides: the angle itself, or the triangle's largest angle. */
  corner: number;
  answer: number;
}

export type BuildVariant = "rectArea" | "rectPerim" | "triArea" | "gridPerim" | "tiltSquare" | "areaPerim";

export interface BuildQuestion extends Base {
  type: "build";
  variant: BuildVariant;
  area: number | null;
  perimeter: number | null;
  /** One shape that works (many others do too). */
  example: Pt[];
  /** The number asked for (area, or perimeter for the perimeter variants). */
  answer: number;
}

export interface DivideQuestion extends Base {
  type: "divide";
  poly: Pt[];
  /** One cut that works. */
  example: [Pt, Pt];
  /** How many straight peg-to-peg cuts work on this board. */
  ways: number;
  answer: number;
}

export type GeometryQuestion = AreaQuestion | PerimeterQuestion | AngleQuestion | ClassifyQuestion | BuildQuestion | DivideQuestion | CircleQuestion | CompositeQuestion | ParallelQuestion;
export type { CircleQuestion, CompositeQuestion, ParallelQuestion };

/** What kind of answer a question wants. */
export const answerKind = (type: GeometryQuestionType): "number" | "choice" | "shape" | "cut" =>
  type === "classify" ? "choice" : type === "build" ? "shape" : type === "divide" ? "cut" : "number";

/** Turn or flip a shape at random, then put it somewhere on the board. */
function place(rng: Rng, shape: Pt[], n: number): Pt[] {
  const swap = rng() < 0.5;
  let pts = shape.map(([x, y]): Pt => (swap ? [y, x] : [x, y]));
  const fx = rng() < 0.5;
  const fy = rng() < 0.5;
  pts = pts.map(([x, y]): Pt => [fx ? -x : x, fy ? -y : y]);
  const b = boxOf(pts);
  const ox = randInt(rng, n - b.w) - b.x0;
  const oy = randInt(rng, n - b.h) - b.y0;
  return pts.map(([x, y]): Pt => [x + ox, y + oy]);
}

const fits = (poly: Pt[], n: number) => poly.every(([x, y]) => x >= 0 && y >= 0 && x < n && y < n);
const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

const rectangle = (w: number, h: number): Pt[] => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
];
const lShape = (W: number, H: number, w: number, h: number): Pt[] => [
  [0, 0],
  [W - w, 0],
  [W - w, h],
  [W, h],
  [W, H],
  [0, H],
];

/** Level 2 area shapes: right and other triangles, L shapes, shapes with 45° sides. */
function level2Shape(rng: Rng, n: number): Pt[] {
  const m = n - 1;
  for (;;) {
    const kind = randInt(rng, 4);
    let s: Pt[];
    if (kind === 0) s = [[0, 0], [between(rng, 2, m), 0], [0, between(rng, 2, m)]];
    else if (kind === 1) {
      const b = between(rng, 2, m);
      const h = between(rng, 2, m - 1);
      const a = between(rng, -1, b + 1);
      if (a === 0 || a === b) continue;
      s = [[0, h], [b, h], [a, 0]];
    } else if (kind === 2) {
      const [W, H] = [between(rng, 3, m), between(rng, 3, m)];
      s = lShape(W, H, between(rng, 1, W - 1), between(rng, 1, H - 1));
    } else {
      const k = between(rng, 1, 3);
      const b = between(rng, 1, 4);
      const v = randInt(rng, 4);
      if (v === 0) s = [[0, k], [b, k], [b + k, 0], [k, 0]];
      else if (v === 1) s = [[0, k], [b + 2 * k, k], [b + k, 0], [k, 0]];
      else if (v === 2) s = [[0, k], [2 * k, k], [k, 0]];
      else {
        const half = between(rng, 1, 3);
        const wall = between(rng, 1, 3);
        s = [[0, half], [half, 0], [2 * half, half], [2 * half, half + wall], [0, half + wall]];
      }
    }
    if (boxOf(s).w > m || boxOf(s).h > m) continue;
    return place(rng, s, n);
  }
}

/** Level 3 area shapes: slanted ones, counted with the bounding rectangle. */
function slantedShape(rng: Rng, n: number): Pt[] {
  const m = n - 1;
  for (;;) {
    const kind = randInt(rng, 3);
    let s: Pt[];
    if (kind === 0) {
      const a = between(rng, 1, m - 1);
      const b = between(rng, 1, m - a);
      s = [[a, 0], [a + b, a], [b, a + b], [0, b]];
    } else if (kind === 1) {
      const [W, H] = [between(rng, 3, m), between(rng, 3, m)];
      s = [[between(rng, 1, W - 1), 0], [W, between(rng, 1, H - 1)], [between(rng, 1, W - 1), H], [0, between(rng, 1, H - 1)]];
    } else {
      const [W, H] = [between(rng, 3, m), between(rng, 3, m)];
      s = [[0, 0], [W, between(rng, 1, H - 1)], [between(rng, 1, W - 1), H]];
    }
    const b = boxOf(s);
    if (b.w > m || b.h > m || areaMethod(s) !== "box" || bandProblem(s)) continue;
    return place(rng, s, n);
  }
}

function areaQuestion(rng: Rng, level: Level, seed: number): AreaQuestion {
  const n = BOARD[level];
  for (;;) {
    let poly: Pt[];
    if (level === 1) {
      const [w, h] = [between(rng, 2, n - 1), between(rng, 2, n - 1)];
      if (w * h === 2 * (w + h)) continue;
      poly = place(rng, rectangle(w, h), n);
    } else poly = level === 2 ? level2Shape(rng, n) : slantedShape(rng, n);
    return { type: "area", level, seed, n, poly, answer: areaOf(poly) };
  }
}

function perimeterQuestion(rng: Rng, level: Level, seed: number): PerimeterQuestion {
  const n = BOARD[level];
  const m = n - 1;
  for (;;) {
    let s: Pt[];
    if (level === 1) {
      const [w, h] = [between(rng, 2, m), between(rng, 2, m)];
      s = rectangle(w, h);
    } else if (level === 2) {
      const [W, H] = [between(rng, 3, m), between(rng, 3, m)];
      if (rng() < 0.6) s = lShape(W, H, between(rng, 1, W - 1), between(rng, 1, H - 1));
      else {
        // Two steps down from one corner.
        const a = between(rng, 1, W - 2);
        const c = between(rng, a + 1, W - 1);
        const b = between(rng, 1, H - 2);
        const d = between(rng, b + 1, H - 1);
        s = [[0, 0], [a, 0], [a, b], [c, b], [c, d], [W, d], [W, H], [0, H]];
      }
    } else {
      const [W, H] = [between(rng, 4, m), between(rng, 3, m)];
      if (rng() < 0.6) {
        // A notch cut into one side: its two inner sides add to the perimeter.
        const o = between(rng, 1, W - 2);
        const w = between(rng, 1, W - 1 - o);
        const d = between(rng, 1, H - 1);
        s = [[0, 0], [o, 0], [o, d], [o + w, d], [o + w, 0], [W, 0], [W, H], [0, H]];
      } else {
        const c1 = between(rng, 1, W - 2);
        const c2 = between(rng, 1, W - 1 - c1);
        const h = between(rng, 1, H - 1);
        s = [[0, 0], [W, 0], [W, h], [W - c2, h], [W - c2, H], [c1, H], [c1, h], [0, h]];
      }
    }
    s = simplify(s);
    if (bandProblem(s)) continue;
    const poly = place(rng, s, n);
    const answer = perimeterOf(poly)!;
    if (answer === areaOf(poly)) continue;
    return { type: "perimeter", level, seed, n, poly, answer };
  }
}

const DIRS: Pt[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

const step5 = (rng: Rng, lo: number, hi: number) => 5 * between(rng, lo / 5, hi / 5);

function angleQuestion(rng: Rng, level: Level, seed: number): AngleQuestion {
  const n = BOARD[level];
  const base = { type: "angle" as const, level, seed, n, arms: [] as Pt[] };
  if (level === 1) {
    for (;;) {
      const k1 = randInt(rng, 8);
      const k2 = (k1 + between(rng, 1, 3) * (rng() < 0.5 ? 1 : -1) + 8) % 8;
      const arm = (k: number): Pt => {
        const len = k % 2 ? 2 : between(rng, 2, 3);
        return [DIRS[k][0] * len, DIRS[k][1] * len];
      };
      const [u, w] = [arm(k1), arm(k2)];
      const v: Pt = [randInt(rng, n), randInt(rng, n)];
      const arms: Pt[] = [
        [v[0] + u[0], v[1] + u[1]],
        v,
        [v[0] + w[0], v[1] + w[1]],
      ];
      if (!fits(arms, n)) continue;
      const answer = 45 * Math.min((k1 - k2 + 8) % 8, (k2 - k1 + 8) % 8);
      return { ...base, variant: "geo", arms, angles: [answer], given: [], ask: 1, answer };
    }
  }
  for (;;) {
    const v = randInt(rng, level === 2 ? 3 : 2);
    if (level === 2) {
      if (v === 1) {
        const apex = 10 * between(rng, 2, 14);
        const fromApex = rng() < 0.6;
        const angles = [apex, (180 - apex) / 2, (180 - apex) / 2];
        return { ...base, variant: "isosceles", angles, given: fromApex ? [0] : [1], ask: fromApex ? 1 : 0, answer: fromApex ? angles[1] : apex };
      }
      const a = step5(rng, 25, 120);
      const b = step5(rng, 25, 155 - a);
      const angles = [a, b, 180 - a - b];
      if (angles[2] < 20) continue;
      if (v === 0) {
        const ask = randInt(rng, 3);
        return { ...base, variant: "triangle", angles, given: [0, 1, 2].filter((i) => i !== ask), ask, answer: angles[ask] };
      }
      return { ...base, variant: "exterior", angles, given: [0, 1], ask: 2, answer: a + b };
    }
    if (v === 1) {
      const sides = pick(rng, [5, 6, 8, 9, 10, 12]);
      const each = ((sides - 2) * 180) / sides;
      return { ...base, variant: "regular", angles: Array<number>(sides).fill(each), given: [], ask: 0, answer: each };
    }
    const sides = between(rng, 4, 6);
    const angles = Array.from({ length: sides - 1 }, () => step5(rng, 70, 170));
    const last = (sides - 2) * 180 - angles.reduce((s, x) => s + x, 0);
    if (last < 60 || last > 175 || last % 5) continue;
    angles.push(last);
    if (!anglePolygon(angles)) continue;
    const ask = randInt(rng, sides);
    return { ...base, variant: "polygon", angles, given: angles.map((_, i) => i).filter((i) => i !== ask), ask, answer: angles[ask] };
  }
}

const KIND_INDEX: Partial<Record<AngleKind, number>> = { acute: 0, right: 1, obtuse: 2 };

/** The corner that decides a triangle's kind: its largest angle. */
function largestCorner(tri: Pt[]) {
  const a = cornerAngles(tri);
  return a.reduce((best, x, i) => (x.deg > a[best].deg ? i : best), 0);
}

function classifyQuestion(rng: Rng, level: Level, seed: number): ClassifyQuestion {
  const n = BOARD[level];
  const want = randInt(rng, 3);
  for (;;) {
    let poly: Pt[];
    let corner: number;
    if (level === 1) {
      const k = 2 * randInt(rng, 4);
      const len = between(rng, 2, 3);
      const u: Pt = [DIRS[k][0] * len, DIRS[k][1] * len];
      const w: Pt = [between(rng, -3, 3), between(rng, -3, 3)];
      if (cross(u, w) === 0) continue;
      const v: Pt = [randInt(rng, n), randInt(rng, n)];
      poly = [[v[0] + u[0], v[1] + u[1]], v, [v[0] + w[0], v[1] + w[1]]];
      corner = 1;
    } else if (level === 2) {
      const b = between(rng, 2, n - 1);
      const s: Pt[] = [[0, 0], [b, 0], [between(rng, -2, b + 2), between(rng, 2, n - 1)]];
      if (boxOf(s).w > n - 1) continue;
      poly = place(rng, s, n);
      corner = largestCorner(poly);
    } else {
      let s: Pt[];
      if (want === 1) {
        const [a, b] = [between(rng, 1, 3), between(rng, 1, 3)];
        const k = between(rng, 1, 2);
        s = [[0, 0], [a, b], [a - k * b, b + k * a]];
      } else s = [[0, 0], [between(rng, 1, n - 1), between(rng, -3, n - 1)], [between(rng, -3, n - 1), between(rng, 1, n - 1)]];
      if (boxOf(s).w > n - 1 || boxOf(s).h > n - 1 || edgesOf(s).some(([p, q]) => p[0] === q[0] || p[1] === q[1])) continue;
      poly = place(rng, s, n);
      corner = largestCorner(poly);
    }
    if (!fits(poly, n) || (level > 1 && bandProblem(poly))) continue;
    // No needle-thin triangles: every angle at least 15°.
    if (level > 1 && cornerAngles(poly).some((x) => x.deg < 15)) continue;
    const v = poly[corner];
    const kind = level === 1 ? armsKind(sub(poly[0], v), sub(poly[2], v)) : cornerAngles(poly)[corner].kind;
    const answer = KIND_INDEX[kind];
    if (answer !== want) continue;
    return { type: "classify", level, seed, n, poly, corner, answer };
  }
}

function buildQuestion(rng: Rng, level: Level, seed: number): BuildQuestion {
  const n = BOARD[level];
  const m = n - 1;
  const base = { type: "build" as const, level, seed, n };
  for (;;) {
    const second = rng() < 0.5;
    if (level === 1) {
      const [w, h] = [between(rng, 1, m), between(rng, 2, m)];
      const example = place(rng, rectangle(w, h), n);
      if (!second) return { ...base, variant: "rectArea", area: w * h, perimeter: null, example, answer: w * h };
      if (w + h < 3) continue;
      return { ...base, variant: "rectPerim", area: null, perimeter: 2 * (w + h), example, answer: 2 * (w + h) };
    }
    if (level === 2) {
      const [W, H] = [between(rng, 2, m), between(rng, 2, m)];
      if (!second) {
        if (W * H < 3) continue;
        const example = place(rng, [[0, 0], [W, 0], [0, H]], n);
        return { ...base, variant: "triArea", area: (W * H) / 2, perimeter: null, example, answer: (W * H) / 2 };
      }
      const example = place(rng, lShape(W, H, 1, 1), n);
      return { ...base, variant: "gridPerim", area: null, perimeter: 2 * (W + H), example, answer: 2 * (W + H) };
    }
    if (!second) {
      const a = between(rng, 1, m - 1);
      const b = between(rng, 1, m - a);
      const example = place(rng, [[a, 0], [a + b, a], [b, a + b], [0, b]], n);
      return { ...base, variant: "tiltSquare", area: a * a + b * b, perimeter: null, example, answer: a * a + b * b };
    }
    const [W, H] = [between(rng, 3, m), between(rng, 3, m)];
    const [w, h] = [between(rng, 1, W - 1), between(rng, 1, H - 1)];
    const area = W * H - w * h;
    // Keep pairs no rectangle can make, so the L shape is needed.
    if (rectFor(area, W + H)) continue;
    return { ...base, variant: "areaPerim", area, perimeter: 2 * (W + H), example: place(rng, lShape(W, H, w, h), n), answer: area };
  }
}

/** A rectangle with this area and half-perimeter, if there is one. */
function rectFor(area: number, half: number) {
  for (let w = 1; w < half; w++) if (w * (half - w) === area) return [w, half - w];
  return null;
}

function divideQuestion(rng: Rng, level: Level, seed: number): DivideQuestion {
  const n = BOARD[level];
  const m = n - 1;
  for (;;) {
    let s: Pt[];
    if (level === 1) s = rectangle(between(rng, 2, m), between(rng, 2, m));
    else if (level === 2) {
      if (rng() < 0.6) {
        const b = between(rng, 2, m);
        s = [[0, 0], [b, 0], [between(rng, 0, b), between(rng, 2, m)]];
      } else {
        // A trapezoid with one slanted side.
        const H = between(rng, 2, m);
        const top = between(rng, 1, m - 1);
        s = [[0, 0], [top, 0], [between(rng, top + 1, m), H], [0, H]];
      }
    } else {
      const u: Pt = [between(rng, 1, 4), between(rng, 1, 3)];
      const w: Pt = [-between(rng, 1, 3), between(rng, 1, 4)];
      s = rng() < 0.5 ? [[0, 0], u, [u[0] + w[0], u[1] + w[1]], w] : slantedShape(rng, n);
    }
    s = simplify(s);
    const b = boxOf(s);
    if (b.w > m || b.h > m || bandProblem(s) || !isConvex(s)) continue;
    const poly = place(rng, s, n);
    const cuts = halvingCuts(poly);
    if (!cuts.length) continue;
    return { type: "divide", level, seed, n, poly, example: pick(rng, cuts), ways: cuts.length, answer: 0 };
  }
}

export function makeGeometryQuestion(type: GeometryQuestionType, level: Level, seed: number): GeometryQuestion {
  if (type === "circle") return makeCircleQuestion(level, seed);
  if (type === "composite") return makeCompositeQuestion(level, seed);
  if (type === "parallel") return makeParallelQuestion(level, seed);
  const rng = mulberry32(seed * 7 + level * 101 + type.length * 13 + (type === "build" ? 5 : 0));
  switch (type) {
    case "area":
      return areaQuestion(rng, level, seed);
    case "perimeter":
      return perimeterQuestion(rng, level, seed);
    case "angle":
      return angleQuestion(rng, level, seed);
    case "classify":
      return classifyQuestion(rng, level, seed);
    case "build":
      return buildQuestion(rng, level, seed);
    case "divide":
      return divideQuestion(rng, level, seed);
  }
}

export type ShapeKind = "rect" | "triangle" | "polygon" | "slanted";

/** A shape for "new example" in explore, on a board of n × n pegs (n ≥ 5). */
export function sampleShape(kind: ShapeKind, n: number, seed: number): Pt[] {
  const rng = mulberry32(seed * 13 + n * 7 + kind.length);
  for (;;) {
    if (kind === "rect") return place(rng, rectangle(between(rng, 2, n - 1), between(rng, 2, n - 1)), n);
    if (kind === "slanted") return slantedShape(rng, n);
    const s = level2Shape(rng, n);
    if ((kind === "triangle") === (s.length === 3)) return s;
  }
}

// ── Slips ────────────────────────────────────────────────────────────────

export type GeometryTag =
  | "right"
  // area
  | "perimeter"
  | "halfAsWhole"
  | "noHalves"
  | "noHalf"
  | "box"
  | "dots"
  // perimeter
  | "area"
  | "cells"
  | "halfP"
  // angle
  | "supplement"
  | "reflex"
  | "sum360"
  | "noSubtract"
  | "interior"
  | "nTimes180"
  | "total"
  | "exterior"
  // classify
  | "slantRight"
  | "nearRight"
  | "smallAngle"
  | "swap"
  // circle and composite (generators/circle.ts)
  | MeasureTag
  // parallel lines (generators/parallel-angles.ts)
  | ParallelTag
  | "other";

/** Wrong answers with a known cause, in the order they are checked. */
export function slips(q: GeometryQuestion): [GeometryTag, number][] {
  switch (q.type) {
    case "area": {
      const out: [GeometryTag, number][] = [];
      const P = perimeterOf(q.poly);
      if (P !== null) out.push(["perimeter", P]);
      if (isGridOrDiagonal(q.poly)) {
        const { whole, half } = squareCount(q.poly);
        if (half.length) out.push(["halfAsWhole", whole.length + half.length], ["noHalves", whole.length]);
      }
      const b = boxOf(q.poly);
      const pieces = areaMethod(q.poly) === "box" ? boxPieces(q.poly) : null;
      // Forgot "÷ 2": for a triangle, base × height; with corner pieces, each piece doubled.
      if (q.poly.length === 3) out.push(["noHalf", 2 * q.answer]);
      else if (pieces) out.push(["noHalf", b.w * b.h - pieces.reduce((s, p) => s + p.a * p.b, 0)]);
      out.push(["box", b.w * b.h], ["dots", boundaryPegs(q.poly) + insidePegs(q.poly)]);
      return out.filter(([, v]) => v > 0);
    }
    case "perimeter": {
      const b = boxOf(q.poly);
      return [
        ["area", areaOf(q.poly)],
        ["box", 2 * (b.w + b.h)],
        ["dots", q.answer + q.poly.length],
        ["cells", borderCells(q.poly)],
        ["halfP", q.answer / 2],
      ];
    }
    case "angle": {
      const a = q.angles;
      switch (q.variant) {
        case "geo":
          return [
            ["supplement", 180 - q.answer],
            ["reflex", 360 - q.answer],
          ];
        case "triangle": {
          const known = q.given.reduce((s, i) => s + a[i], 0);
          return [
            ["sum360", 360 - known],
            ["noSubtract", known],
          ];
        }
        case "isosceles":
          return q.ask === 1
            ? [
                ["noHalf", 180 - a[0]],
                ["sum360", (360 - a[0]) / 2],
              ]
            : [
                ["noHalf", 180 - a[1]],
                ["sum360", 360 - 2 * a[1]],
              ];
        case "exterior":
          return [
            ["interior", 180 - q.answer],
            ["sum360", 360 - q.answer],
          ];
        case "polygon": {
          const known = q.given.reduce((s, i) => s + a[i], 0);
          const sides = a.length;
          return [
            ["nTimes180", sides * 180 - known],
            ["sum360", (sides === 4 ? 540 : 360) - known],
            ["total", (sides - 2) * 180],
          ];
        }
        case "regular":
          return [
            ["exterior", 360 / a.length],
            ["total", (a.length - 2) * 180],
          ];
      }
      return [];
    }
    case "classify": {
      const out: [GeometryTag, number][] = [];
      const v = q.poly[q.corner];
      const [p, r] = q.level === 1 ? [q.poly[0], q.poly[2]] : [q.poly[(q.corner + 2) % 3], q.poly[(q.corner + 1) % 3]];
      const [u, w] = [sub(p, v), sub(r, v)];
      const slanted = u[0] !== 0 && u[1] !== 0 && w[0] !== 0 && w[1] !== 0;
      if (q.answer === 1 && slanted) out.push(["slantRight", 0], ["slantRight", 2]);
      if (q.answer !== 1 && Math.abs(degrees(u, w) - 90) < 12) out.push(["nearRight", 1]);
      if (q.level > 1 && q.answer !== 0) out.push(["smallAngle", 0]);
      if (q.answer !== 1) out.push(["swap", 2 - q.answer]);
      return out;
    }
    case "circle":
    case "composite":
    case "parallel":
      return q.slips.map((s): [GeometryTag, number] => [s.tag, s.value]);
    default:
      return [];
  }
}

/** Which slip an answer is, if any. */
export function geometryMistake(q: GeometryQuestion, value: number, known = slips(q)): GeometryTag {
  // Decimal answers are compared in hundredths.
  if (q.type === "circle" || q.type === "composite") return measureMistake(q, value);
  if (q.type === "parallel") return parallelMistake(q, value);
  if (value === q.answer) return "right";
  for (const [tag, v] of known) if (v !== q.answer && value === v) return tag;
  return "other";
}

// ── Checking built shapes and cuts ──────────────────────────────────────

export type BuildTag = "right" | "few" | "crossing" | "notRect" | "notTri" | "notSquare" | "notSlanted" | "notGrid" | "isRect" | "confused" | "noHalf" | "areaOnly" | "perimOnly" | "wrongValue";

export interface BuildResult {
  tag: BuildTag;
  /** The band's area and perimeter (perimeter null when a side is slanted). */
  area: number;
  perimeter: number | null;
}

/** Any shape that meets the request is right; the rest get the reason. */
export function checkBuild(q: BuildQuestion, poly: Pt[]): BuildResult {
  const problem = bandProblem(poly);
  if (problem) return { tag: problem === "few" ? "few" : "crossing", area: 0, perimeter: null };
  const s = simplify(poly);
  const area = areaOf(s);
  const perimeter = perimeterOf(s);
  const r = (tag: BuildTag): BuildResult => ({ tag, area, perimeter });
  switch (q.variant) {
    case "rectArea":
      if (!isRect(s)) return r("notRect");
      return r(area === q.area ? "right" : perimeter === q.area ? "confused" : "wrongValue");
    case "rectPerim":
      if (!isRect(s)) return r("notRect");
      return r(perimeter === q.perimeter ? "right" : area === q.perimeter ? "confused" : "wrongValue");
    case "triArea":
      if (s.length !== 3) return r("notTri");
      return r(area === q.area ? "right" : area === 2 * q.area! ? "noHalf" : "wrongValue");
    case "gridPerim":
      if (perimeter === null) return r("notGrid");
      if (perimeter === q.perimeter) return r(isRect(s) ? "isRect" : "right");
      return r(area === q.perimeter ? "confused" : "wrongValue");
    case "tiltSquare":
      if (!isSquare(s)) return r("notSquare");
      if (isRectilinear(s)) return r("notSlanted");
      return r(area === q.area ? "right" : "wrongValue");
    case "areaPerim":
      if (perimeter === null) return r("notGrid");
      if (area === q.area && perimeter === q.perimeter) return r("right");
      return r(area === q.area ? "areaOnly" : perimeter === q.perimeter ? "perimOnly" : "wrongValue");
  }
}

export type CutTag = "right" | "few" | "notEdge" | "alongEdge" | "unequal";

/** Check a straight band from peg a to peg b across the shape. */
export function checkCut(q: DivideQuestion, a: Pt, b: Pt): { tag: CutTag; parts: [number, number] | null } {
  if (samePt(a, b)) return { tag: "few", parts: null };
  if (!onBand(q.poly, a) || !onBand(q.poly, b)) return { tag: "notEdge", parts: null };
  const parts = cutAreas(q.poly, a, b);
  if (!parts) return { tag: "alongEdge", parts: null };
  return { tag: parts[0] === parts[1] ? "right" : "unequal", parts };
}

/** "x-y_x-y" for links. */
export const ptsToParam = (pts: Pt[]) => pts.map(([x, y]) => `${x}-${y}`).join("_");
export function ptsFromParam(s: string | null, n: number): Pt[] | null {
  if (!s) return null;
  const pts = s.split("_").map((t) => t.split("-").map(Number));
  if (!pts.every((p) => p.length === 2 && p.every((v) => Number.isInteger(v) && v >= 0 && v < n))) return null;
  return pts as Pt[];
}
