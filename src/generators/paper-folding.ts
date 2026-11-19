// Paper folding (tool 2). Pure TypeScript.
//
// The paper is an S×S square in paper coordinates (x right, y up), lying on a
// grid of unit cells. A fold reflects one side of a line onto the other.
// Folds are only made along symmetry lines of the current folded shape, so
// each fold halves it. Fold lines sit on whole-number coordinates, so a cell
// centre always reflects onto a cell centre.
//
// Holes punched in the folded paper go through every layer; unfolding mirrors
// them back across each fold line, last fold first.

import { mulberry32, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type Pt = [number, number];
export type Poly = Pt[];

/** v: x = c · h: y = c · d: y − x = c (rising diagonal) · a: x + y = c (falling diagonal) */
export type LineKind = "v" | "h" | "d" | "a";
export interface FoldLine {
  kind: LineKind;
  c: number;
}
/** `moving`: which side of the line is lifted and folded over (sign of `side`). */
export interface Fold {
  line: FoldLine;
  moving: 1 | -1;
}

const EPS = 1e-7;
const R2 = Math.SQRT1_2;
const clean = (v: number) => Math.round(v * 1e6) / 1e6 || 0;

export function lineNormal(l: FoldLine): { n: Pt; o: number } {
  switch (l.kind) {
    case "v":
      return { n: [1, 0], o: l.c };
    case "h":
      return { n: [0, 1], o: l.c };
    case "d":
      return { n: [-R2, R2], o: l.c * R2 };
    case "a":
      return { n: [R2, R2], o: l.c * R2 };
  }
}

/** Signed distance from the line (positive on the normal's side). */
export const side = (p: Pt, l: FoldLine) => {
  const { n, o } = lineNormal(l);
  return n[0] * p[0] + n[1] * p[1] - o;
};

export function reflect(p: Pt, l: FoldLine): Pt {
  const { n } = lineNormal(l);
  const s = side(p, l);
  return [clean(p[0] - 2 * s * n[0]), clean(p[1] - 2 * s * n[1])];
}

export const reflectPoly = (poly: Poly, l: FoldLine): Poly => poly.map((p) => reflect(p, l));

/** Part of a convex polygon on one side of a line (keep = +1: side ≥ 0). */
export function clip(poly: Poly, l: FoldLine, keep: 1 | -1): Poly {
  const out: Poly = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = keep * side(a, l);
    const sb = keep * side(b, l);
    if (sa >= -EPS) out.push(a);
    if ((sa > EPS && sb < -EPS) || (sa < -EPS && sb > EPS)) {
      const t = sa / (sa - sb);
      out.push([clean(a[0] + t * (b[0] - a[0])), clean(a[1] + t * (b[1] - a[1]))]);
    }
  }
  return dedupe(out);
}

/** Intersection of two convex polygons. */
export function intersect(a: Poly, b: Poly): Poly {
  let out = a;
  for (let i = 0; i < b.length && out.length; i++) {
    const p = b[i];
    const q = b[(i + 1) % b.length];
    // Keep the side of edge pq that holds b's interior.
    const inner = centroid(b);
    out = clipByEdge(out, p, q, inner);
  }
  return out;
}

function clipByEdge(poly: Poly, p: Pt, q: Pt, inner: Pt): Poly {
  const f = (r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const sgn = Math.sign(f(inner)) || 1;
  const out: Poly = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = sgn * f(a);
    const sb = sgn * f(b);
    if (sa >= -EPS) out.push(a);
    if ((sa > EPS && sb < -EPS) || (sa < -EPS && sb > EPS)) {
      const t = sa / (sa - sb);
      out.push([clean(a[0] + t * (b[0] - a[0])), clean(a[1] + t * (b[1] - a[1]))]);
    }
  }
  return dedupe(out);
}

function dedupe(poly: Poly): Poly {
  const out: Poly = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > EPS || Math.abs(last[1] - p[1]) > EPS) out.push(p);
  }
  if (out.length > 1 && Math.abs(out[0][0] - out[out.length - 1][0]) < EPS && Math.abs(out[0][1] - out[out.length - 1][1]) < EPS) out.pop();
  return out;
}

export function area(poly: Poly): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function centroid(poly: Poly): Pt {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const cr = x1 * y2 - x2 * y1;
    a += cr;
    cx += (x1 + x2) * cr;
    cy += (y1 + y2) * cr;
  }
  return [clean(cx / (3 * a)), clean(cy / (3 * a))];
}

const samePoint = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 1e-5 && Math.abs(a[1] - b[1]) < 1e-5;

/** Same polygon (same vertices, any order or orientation). */
export const samePoly = (a: Poly, b: Poly) => a.length === b.length && a.every((p) => b.some((q) => samePoint(p, q)));

/** Strictly inside a convex polygon. */
export function inside(p: Pt, poly: Poly): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(cr) < EPS) return false;
    const s = Math.sign(cr);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

export const square = (S: number): Poly => [
  [0, 0],
  [S, 0],
  [S, S],
  [0, S],
];

/** The folded shape after a fold: the side that stays. */
export const foldShape = (poly: Poly, f: Fold): Poly => clip(poly, f.line, (-f.moving) as 1 | -1);

/** Shapes before each fold, then the final folded shape (length = folds + 1). */
export function shapes(S: number, folds: Fold[]): Poly[] {
  const out = [square(S)];
  for (const f of folds) out.push(foldShape(out[out.length - 1], f));
  return out;
}

/** Lines through the shape's centre (on whole numbers) that are mirror lines of it. */
export function symmetryLines(poly: Poly, kinds: LineKind[] = ["v", "h", "d", "a"]): FoldLine[] {
  const [cx, cy] = centroid(poly);
  const candidates: FoldLine[] = [
    { kind: "v", c: cx },
    { kind: "h", c: cy },
    { kind: "d", c: clean(cy - cx) },
    { kind: "a", c: clean(cx + cy) },
  ];
  return candidates.filter((l) => kinds.includes(l.kind) && Number.isInteger(l.c) && samePoly(reflectPoly(poly, l), poly));
}

const inSquare = (p: Pt, S: number) => p[0] > 0 && p[1] > 0 && p[0] < S && p[1] < S;
const dedupePts = (pts: Pt[]) => pts.filter((p, i) => pts.findIndex((q) => samePoint(p, q)) === i);

/** Unfold points punched through the folded paper: mirror across each fold, last first. */
export function unfoldPoints(pts: Pt[], folds: Fold[]): Pt[] {
  let out = dedupePts(pts);
  for (let i = folds.length - 1; i >= 0; i--) out = dedupePts([...out, ...out.map((p) => reflect(p, folds[i].line))]);
  return out;
}

/** Unfold polygons (cut-away pieces) the same way. */
export function unfoldPolys(polys: Poly[], folds: Fold[]): Poly[] {
  let out = polys;
  for (let i = folds.length - 1; i >= 0; i--) out = [...out, ...out.map((p) => reflectPoly(p, folds[i].line))];
  return out;
}

/** Unfold cut segments the same way. */
export function unfoldSegments(segs: [Pt, Pt][], folds: Fold[]): [Pt, Pt][] {
  let out = segs;
  for (let i = folds.length - 1; i >= 0; i--)
    out = [...out, ...out.map(([a, b]): [Pt, Pt] => [reflect(a, folds[i].line), reflect(b, folds[i].line)])];
  return out;
}

/**
 * Fold lines as creases on the opened paper (later folds are mirrored by
 * earlier ones). With `from`, the paper is still folded by the first `from`
 * folds and only the creases of the folds after them are shown.
 */
export function creases(S: number, folds: Fold[], from = 0): [Pt, Pt][] {
  const before = shapes(S, folds);
  return folds.flatMap((f, i) => {
    if (i < from) return [];
    const c = chord(f.line, before[i]);
    return c ? unfoldSegments([c], folds.slice(from, i)) : [];
  });
}

export const cellKey = (p: Pt) => `${Math.floor(p[0])},${Math.floor(p[1])}`;
export const cellCenter = (i: number, j: number): Pt => [i + 0.5, j + 0.5];
export const holeCells = (pts: Pt[]) => [...new Set(pts.map(cellKey))].sort();

/** The part of a straight line inside a convex polygon (null if it misses). */
export function chord(l: FoldLine, poly: Poly): [Pt, Pt] | null {
  const pts: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a, l);
    const sb = side(b, l);
    if (Math.abs(sa) < EPS) pts.push(a);
    else if ((sa > 0 && sb < -EPS) || (sa < 0 && sb > EPS)) {
      const t = sa / (sa - sb);
      pts.push([clean(a[0] + t * (b[0] - a[0])), clean(a[1] + t * (b[1] - a[1]))]);
    }
  }
  const uniq = dedupePts(pts);
  return uniq.length >= 2 ? [uniq[0], uniq[uniq.length - 1]] : null;
}

/**
 * Pieces of the S×S paper after cutting along all `segs` (each cut has no
 * width; we rasterise at `res` px per unit and count connected regions).
 */
export function countPieces(S: number, segs: [Pt, Pt][], res = 24): number {
  const W = S * res;
  const blocked = new Uint8Array(W * W);
  const half = 0.9 / res;
  for (const [a, b] of segs) {
    const minX = Math.max(0, Math.floor((Math.min(a[0], b[0]) - half) * res));
    const maxX = Math.min(W - 1, Math.ceil((Math.max(a[0], b[0]) + half) * res));
    const minY = Math.max(0, Math.floor((Math.min(a[1], b[1]) - half) * res));
    const maxY = Math.min(W - 1, Math.ceil((Math.max(a[1], b[1]) + half) * res));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    for (let v = minY; v <= maxY; v++)
      for (let u = minX; u <= maxX; u++) {
        const px = (u + 0.5) / res;
        const py = (v + 0.5) / res;
        const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
        const qx = a[0] + t * dx - px;
        const qy = a[1] + t * dy - py;
        if (qx * qx + qy * qy < half * half) blocked[v * W + u] = 1;
      }
  }
  const seen = new Uint8Array(W * W);
  const minSize = 0.05 * res * res;
  let pieces = 0;
  const stack: number[] = [];
  for (let start = 0; start < W * W; start++) {
    if (blocked[start] || seen[start]) continue;
    let size = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      size++;
      const u = k % W;
      const v = (k - u) / W;
      for (const [nu, nv] of [
        [u + 1, v],
        [u - 1, v],
        [u, v + 1],
        [u, v - 1],
      ]) {
        if (nu < 0 || nv < 0 || nu >= W || nv >= W) continue;
        const n = nv * W + nu;
        if (!blocked[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (size >= minSize) pieces++;
  }
  return pieces;
}

/** Bitmap key of the cut-away area, for telling pictures apart. */
export function maskKey(S: number, polys: Poly[], res = 8): string {
  let key = "";
  for (let v = 0; v < S * res; v++)
    for (let u = 0; u < S * res; u++) {
      const p: Pt = [(u + 0.5) / res, (v + 0.5) / res];
      key += polys.some((poly) => inside(p, poly)) ? "1" : "0";
    }
  return key;
}

// ---------------------------------------------------------------------------
// Layers for the 3D animation.

/** One flat panel of paper and, for each fold, whether it was on the moving side. */
export interface Facet {
  /** In paper coordinates (unfolded). */
  poly: Poly;
  moved: boolean[];
}

const applyFolds = (p: Pt, moved: boolean[], folds: Fold[]) => moved.reduce((q, m, j) => (m ? reflect(q, folds[j].line) : q), p);
const undoFolds = (p: Pt, moved: boolean[], folds: Fold[]) => moved.reduceRight((q, m, j) => (m ? reflect(q, folds[j].line) : q), p);

/** Split the paper into the panels that move together; there are 2^folds of them. */
export function facets(S: number, folds: Fold[]): Facet[] {
  let list: Facet[] = [{ poly: square(S), moved: [] }];
  folds.forEach((f) => {
    const next: Facet[] = [];
    for (const fa of list) {
      const world = fa.poly.map((p) => applyFolds(p, fa.moved, folds));
      const stay = clip(world, f.line, (-f.moving) as 1 | -1);
      const move = clip(world, f.line, f.moving);
      if (area(stay) > EPS) next.push({ poly: stay.map((p) => undoFolds(p, fa.moved, folds)), moved: [...fa.moved, false] });
      if (area(move) > EPS) next.push({ poly: move.map((p) => undoFolds(p, fa.moved, folds)), moved: [...fa.moved, true] });
    }
    list = next;
  });
  return list;
}

/** Where a panel lies once fully folded (paper coordinates of the table). */
export const foldedPoly = (fa: Facet, folds: Fold[]) => fa.poly.map((p) => applyFolds(p, fa.moved, folds));

// ---------------------------------------------------------------------------
// Random fold sequences.

function randomFolds(rng: Rng, S: number, k: number, kinds: LineKind[], wantDiagonal = false): Fold[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const folds: Fold[] = [];
    let shape = square(S);
    for (let i = 0; i < k; i++) {
      const lines = symmetryLines(shape, kinds);
      if (!lines.length) break;
      const line = lines[randInt(rng, lines.length)];
      const f: Fold = { line, moving: rng() < 0.5 ? 1 : -1 };
      folds.push(f);
      shape = foldShape(shape, f);
    }
    if (folds.length !== k) continue;
    if (wantDiagonal && !folds.some((f) => f.line.kind === "d" || f.line.kind === "a")) continue;
    return folds;
  }
  throw new Error("no fold sequence");
}

/** Cells of the folded shape where a hole can be punched (inside, never on a fold line). */
export function punchableCells(S: number, folds: Fold[]): Pt[] {
  const final = shapes(S, folds).at(-1)!;
  const out: Pt[] = [];
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const p = cellCenter(i, j);
      if (inside(p, final) && folds.every((f) => Math.abs(side(p, f.line)) > EPS)) out.push(p);
    }
  return out;
}

/** On the edge of a convex polygon (not strictly inside, not outside). */
export function onBoundary(p: Pt, poly: Poly): boolean {
  return poly.some((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
    const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    return Math.abs(cr) < EPS && dot > -EPS && dot < len2 + EPS;
  });
}

/**
 * Spots on a fold of the folded shape where a hole can be punched: the middle
 * of a grid edge or a cell centre that lies on a crease. Such a hole goes
 * through the fold itself, so when that fold is opened its two halves meet
 * and make one hole on the crease, not two. Spots on the sheet's own edge are
 * left out (a punch there only bites a notch out of the edge).
 */
export function creaseSpots(S: number, folds: Fold[]): Pt[] {
  if (!folds.length) return [];
  const final = shapes(S, folds).at(-1)!;
  const out: Pt[] = [];
  for (let v = 0; v <= 2 * S; v++)
    for (let u = 0; u <= 2 * S; u++) {
      if (u % 2 === 0 && v % 2 === 0) continue; // grid corners
      const p: Pt = [u / 2, v / 2];
      if (onBoundary(p, final) && unfoldPoints([p], folds).every((q) => inSquare(q, S))) out.push(p);
    }
  return out;
}

/** A small triangle cut off one corner of the folded shape. */
export function cornerCut(shape: Poly, vertex: number, leg = 1): Poly {
  const v = shape[vertex];
  const prev = shape[(vertex + shape.length - 1) % shape.length];
  const next = shape[(vertex + 1) % shape.length];
  const toward = (q: Pt): Pt => {
    const d = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const t = Math.min(leg, d / 2) / d;
    return [clean(v[0] + (q[0] - v[0]) * t), clean(v[1] + (q[1] - v[1]) * t)];
  };
  return [v, toward(next), toward(prev)];
}

// ---------------------------------------------------------------------------
// Questions.

export type PaperQuestionType = "holes" | "holesChoice" | "cutChoice" | "pieces" | "foldedShape" | "order";
export type PaperMistake = "missingFold" | "wrongAxis" | "shifted" | "otherSide" | "otherCorner" | "offByOne";

interface Base {
  seed: number;
  level: Level;
  S: number;
  folds: Fold[];
}

export type PaperQuestion =
  | (Base & { type: "holes"; punches: Pt[]; answer: string[] })
  | (Base & { type: "holesChoice"; punches: Pt[]; options: Pt[][]; mistakes: (PaperMistake | null)[]; answer: number })
  | (Base & { type: "cutChoice"; cut: Poly; options: Poly[][]; mistakes: (PaperMistake | null)[]; answer: number })
  | (Base & { type: "pieces"; segment: [Pt, Pt]; options: number[]; mistakes: (PaperMistake | null)[]; answer: number })
  | (Base & { type: "foldedShape"; options: Poly[]; mistakes: (PaperMistake | null)[]; answer: number })
  /**
   * `shown[n]`: which step the n-th picture is. With two or more folds the
   * steps are the folds. With one fold there is nothing to put in order, so
   * the steps are the whole job instead (ORDER_ONE_FOLD): fold, punch
   * `punches` in the folded paper, open it. `punches` is empty otherwise.
   */
  | (Base & { type: "order"; shown: number[]; punches: Pt[] });

/** The steps of a one-fold "order" question, in the right order. */
export const ORDER_ONE_FOLD = ["fold", "punch", "open"] as const;

/** How many pictures an "order" question puts in order. */
export const orderSteps = (folds: Fold[]) => (folds.length === 1 ? ORDER_ONE_FOLD.length : folds.length);

const SETUP: Record<Level, { S: number; k: number; kinds: LineKind[]; diagonal: boolean; holes: [number, number] }> = {
  1: { S: 4, k: 1, kinds: ["v", "h"], diagonal: false, holes: [1, 1] },
  2: { S: 4, k: 2, kinds: ["v", "h"], diagonal: false, holes: [1, 2] },
  3: { S: 8, k: 3, kinds: ["v", "h", "d", "a"], diagonal: true, holes: [1, 2] },
};

/** The perpendicular mirror line through the square's centre (a typical mix-up). */
export function perpendicular(l: FoldLine, S: number): FoldLine {
  switch (l.kind) {
    case "v":
      return { kind: "h", c: S / 2 };
    case "h":
      return { kind: "v", c: S / 2 };
    case "d":
      return { kind: "a", c: S };
    case "a":
      return { kind: "d", c: 0 };
  }
}

const ptsKey = (pts: Pt[]) => holeCells(pts).join(";");

function choose<T>(rng: Rng, correct: T, candidates: { value: T; mistake: PaperMistake }[], key: (v: T) => string) {
  const chosen: { value: T; mistake: PaperMistake | null }[] = [{ value: correct, mistake: null }];
  const keys = new Set([key(correct)]);
  for (const c of candidates) {
    if (chosen.length === 4) break;
    const k = key(c.value);
    if (!keys.has(k)) {
      keys.add(k);
      chosen.push(c);
    }
  }
  const order = shuffle(rng, chosen.map((_, i) => i));
  return { options: order.map((i) => chosen[i].value), mistakes: order.map((i) => chosen[i].mistake), answer: order.indexOf(0) };
}

export function makePaperQuestion(type: PaperQuestionType, level: Level, seed: number): PaperQuestion {
  const rng = mulberry32(seed);
  const setup = SETUP[level];
  const S = setup.S;
  const k = setup.k;
  const folds = randomFolds(rng, S, k, setup.kinds, setup.diagonal);
  const final = shapes(S, folds).at(-1)!;

  if (type === "order") {
    let shown = shuffle(rng, Array.from({ length: orderSteps(folds) }, (_, i) => i));
    while (shown.every((v, i) => v === i)) shown = shuffle(rng, shown);
    const punches = k === 1 ? shuffle(rng, punchableCells(S, folds)).slice(0, 1) : [];
    return { type, seed, level, S, folds, shown, punches };
  }

  if (type === "foldedShape") {
    const candidates: { value: Poly; mistake: PaperMistake }[] = [];
    folds.forEach((_, i) => {
      const flipped = folds.map((f, j) => (j === i ? { ...f, moving: (-f.moving) as 1 | -1 } : f));
      candidates.push({ value: shapes(S, flipped).at(-1)!, mistake: "otherSide" });
    });
    for (let tries = 0; tries < 20; tries++) {
      const other = randomFolds(rng, S, k, setup.kinds);
      candidates.push({ value: shapes(S, other).at(-1)!, mistake: "wrongAxis" });
    }
    return { type, seed, level, S, folds, ...choose(rng, final, candidates, (p) => maskKey(S, [p], 4)) };
  }

  if (type === "pieces") {
    const kinds: LineKind[] = level === 3 ? ["v", "h", "d", "a"] : ["v", "h"];
    for (let attempt = 0; attempt < 200; attempt++) {
      const kind = kinds[randInt(rng, kinds.length)];
      const c = randInt(rng, 4 * S) / 2 - (kind === "d" ? S : 0) + 0.5;
      const line: FoldLine = { kind, c };
      const seg = chord(line, final);
      if (!seg || folds.some((f) => f.line.kind === kind && Math.abs(f.line.c - c) < 1e-6)) continue;
      // Along an edge of the folded paper nothing is cut: the cut must go through the inside.
      if (!inside([(seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2], final)) continue;
      // The cut must cross the folded shape, not just touch a corner.
      if (Math.hypot(seg[0][0] - seg[1][0], seg[0][1] - seg[1][1]) < 0.9) continue;
      const pieces = countPieces(S, unfoldSegments([seg], folds));
      const special = [{ value: 2 ** k, mistake: "offByOne" as const }, { value: pieces + 1, mistake: "offByOne" as const }, { value: pieces - 1, mistake: "offByOne" as const }, { value: pieces + 2, mistake: "offByOne" as const }].filter((s) => s.value > 0);
      return { type, seed, level, S, folds, segment: seg, ...choose(rng, pieces, special, String) };
    }
    throw new Error("no cut line");
  }

  if (type === "cutChoice") {
    const vertex = randInt(rng, final.length);
    const cut = cornerCut(final, vertex, S === 8 ? 1.5 : 1);
    const correct = unfoldPolys([cut], folds);
    const wrongAxisFolds = folds.map((f, i) => (i === 0 ? { ...f, line: perpendicular(f.line, S) } : f));
    const candidates: { value: Poly[]; mistake: PaperMistake }[] = [
      { value: unfoldPolys([cut], folds.slice(1)), mistake: "missingFold" },
      { value: unfoldPolys([cut], wrongAxisFolds), mistake: "wrongAxis" },
    ];
    for (let v = 0; v < final.length; v++) if (v !== vertex) candidates.push({ value: unfoldPolys([cornerCut(final, v, S === 8 ? 1.5 : 1)], folds), mistake: "otherCorner" });
    return { type, seed, level, S, folds, cut, ...choose(rng, correct, shuffle(rng, candidates), (polys) => maskKey(S, polys.map((p) => intersect(p, square(S))).filter((p) => p.length > 2))) };
  }

  // Holes
  const cells = shuffle(rng, punchableCells(S, folds));
  const n = Math.min(cells.length, setup.holes[0] + randInt(rng, setup.holes[1] - setup.holes[0] + 1));
  const punches = cells.slice(0, Math.max(1, n));
  const unfolded = unfoldPoints(punches, folds);

  if (type === "holes") return { type, seed, level, S, folds, punches, answer: holeCells(unfolded) };

  const candidates: { value: Pt[]; mistake: PaperMistake }[] = [{ value: unfoldPoints(punches, folds.slice(1)), mistake: "missingFold" }];
  // The wrong mirror line for one of the folds.
  folds.forEach((_, i) => {
    const wrong = folds.map((f, j) => (j === i ? { ...f, line: perpendicular(f.line, S) } : f));
    const pts = unfoldPoints(punches, wrong).filter((p) => inSquare(p, S));
    if (pts.length) candidates.push({ value: pts, mistake: "wrongAxis" });
  });
  for (const [dx, dy] of shuffle(rng, [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]] as Pt[])) {
    const moved = unfolded.map(([x, y]): Pt => [x + dx, y + dy]);
    if (moved.every((p) => inSquare(p, S))) candidates.push({ value: moved, mistake: "shifted" });
  }
  // Holes punched somewhere else on the folded paper.
  for (let i = 0; i < 12; i++) {
    const other = unfoldPoints(shuffle(rng, punchableCells(S, folds)).slice(0, punches.length), folds);
    candidates.push({ value: other, mistake: "shifted" });
  }
  // Last resort: the right holes plus one extra, or one missing.
  candidates.push({ value: unfolded.slice(1), mistake: "missingFold" });
  return { type, seed, level, S, folds, punches, ...choose(rng, unfolded, candidates, ptsKey) };
}
