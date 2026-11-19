// Tool 5: counting shapes in a compound figure. A figure is a set of straight
// segments; every crossing becomes a point and each segment a line through
// its points in order. Shapes are counted by listing every one of them, so
// the same list gives the answer, the step-by-step showing and the check of
// the child's taps.

import { mulberry32, pick, type Rng } from "./random";

export type Pt = [number, number];
export type Level = 1 | 2 | 3;

export interface CountFigure {
  pts: Pt[];
  /** Point indices along each drawn line, in order. */
  lines: number[][];
  /** Smallest regions (point indices around each, counter-clockwise). */
  faces: number[][];
  /** Corner of the rays, for counting angles. */
  origin?: number;
}

/**
 * Figure families (a and b are their sizes):
 * grid a×b squares · fan: triangle cut by lines from the top into a parts,
 * with b level lines · triGrid: triangle of a rows · star: a = 1 adds the
 * pentagon · envelope: rectangle with both diagonals, a = 1 or 2 adds the
 * middle lines · rays: a rays from one point, b = 1 puts them on a straight
 * line · line: a points on a segment.
 */
export type Family = "grid" | "fan" | "triGrid" | "star" | "envelope" | "rays" | "line";

export interface FigureSpec {
  family: Family;
  a: number;
  b: number;
}

export type Kind = "triangle" | "square" | "rectangle" | "segment" | "angle";

export interface Shape {
  kind: Kind;
  /** Polygon corners in order; a segment's two ends; an angle's [tip, corner, tip]. */
  pts: number[];
  /** How many smallest pieces it is made of. */
  pieces: number;
}

const EPS = 1e-7;
const keyOf = ([x, y]: Pt) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)}`;
const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Points and lines of a set of segments; `extra` points are put on the segments they lie on. */
export function buildFigure(segs: [Pt, Pt][], extra: Pt[] = [], origin?: Pt): CountFigure {
  const pts: Pt[] = [];
  const index = new Map<string, number>();
  const idOf = (p: Pt) => {
    const k = keyOf(p);
    let i = index.get(k);
    if (i === undefined) {
      i = pts.length;
      pts.push(p);
      index.set(k, i);
    }
    return i;
  };

  const lines = segs.map(([p, q], si) => {
    const d: Pt = [q[0] - p[0], q[1] - p[1]];
    const on: { t: number; p: Pt }[] = [
      { t: 0, p },
      { t: 1, p: q },
    ];
    segs.forEach(([r, s], sj) => {
      if (sj === si) return;
      const e: Pt = [s[0] - r[0], s[1] - r[1]];
      const den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < EPS) return;
      const t = ((r[0] - p[0]) * e[1] - (r[1] - p[1]) * e[0]) / den;
      const u = ((r[0] - p[0]) * d[1] - (r[1] - p[1]) * d[0]) / den;
      if (t > -EPS && t < 1 + EPS && u > -EPS && u < 1 + EPS) on.push({ t, p: [p[0] + d[0] * t, p[1] + d[1] * t] });
    });
    const len2 = d[0] * d[0] + d[1] * d[1];
    for (const x of extra) {
      if (Math.abs(cross(p, q, x)) > 1e-6) continue;
      const t = ((x[0] - p[0]) * d[0] + (x[1] - p[1]) * d[1]) / len2;
      if (t > -EPS && t < 1 + EPS) on.push({ t, p: x });
    }
    on.sort((a, b) => a.t - b.t);
    const ids: number[] = [];
    for (const o of on) {
      const i = idOf(o.p);
      if (ids[ids.length - 1] !== i) ids.push(i);
    }
    return ids;
  });

  return { pts, lines, faces: facesOf(pts, lines), origin: origin ? index.get(keyOf(origin)) : undefined };
}

/** Bounded regions of the drawing, found by walking around each one. */
function facesOf(pts: Pt[], lines: number[][]): number[][] {
  const nb: number[][] = pts.map(() => []);
  for (const l of lines)
    for (let i = 0; i + 1 < l.length; i++) {
      nb[l[i]].push(l[i + 1]);
      nb[l[i + 1]].push(l[i]);
    }
  const ang = (a: number, b: number) => Math.atan2(pts[b][1] - pts[a][1], pts[b][0] - pts[a][0]);
  nb.forEach((list, v) => list.sort((a, b) => ang(v, a) - ang(v, b)));
  const seen = new Set<string>();
  const faces: number[][] = [];
  nb.forEach((list, u0) =>
    list.forEach((v0) => {
      if (seen.has(`${u0}>${v0}`)) return;
      const face: number[] = [];
      let [u, v] = [u0, v0];
      while (!seen.has(`${u}>${v}`) && face.length <= pts.length) {
        seen.add(`${u}>${v}`);
        face.push(u);
        const around = nb[v];
        const w = around[(around.indexOf(u) - 1 + around.length) % around.length];
        [u, v] = [v, w];
      }
      if (area(face.map((i) => pts[i])) > 1e-6) faces.push(face);
    }),
  );
  return faces;
}

const area = (poly: Pt[]) => poly.reduce((s, p, i) => s + cross([0, 0], p, poly[(i + 1) % poly.length]), 0) / 2;

export const centroid = (ps: Pt[]): Pt => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];

/** Strictly inside a convex polygon (either orientation). */
function inside(poly: Pt[], x: Pt) {
  const signs = poly.map((p, i) => Math.sign(cross(p, poly[(i + 1) % poly.length], x)));
  return signs.every((s) => s > 0) || signs.every((s) => s < 0);
}

/** Line through each pair of points, or −1. */
function lineTable(fig: CountFigure): Int16Array {
  const n = fig.pts.length;
  const t = new Int16Array(n * n).fill(-1);
  fig.lines.forEach((l, li) => {
    for (const a of l) for (const b of l) if (a !== b) t[a * n + b] = li;
  });
  return t;
}

const piecesOf = (fig: CountFigure, poly: number[]) => {
  const ps = poly.map((i) => fig.pts[i]);
  return fig.faces.filter((f) => inside(ps, centroid(f.map((i) => fig.pts[i])))).length;
};

/** Every shape of a kind in the figure, smallest first. Rectangles and squares are the upright ones. */
export function listShapes(fig: CountFigure, kind: Kind): Shape[] {
  const n = fig.pts.length;
  const line = lineTable(fig);
  const on = (a: number, b: number) => line[a * n + b] >= 0;
  const out: Shape[] = [];

  if (kind === "triangle") {
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        if (!on(a, b)) continue;
        for (let c = b + 1; c < n; c++)
          if (on(b, c) && on(a, c) && line[a * n + b] !== line[b * n + c]) {
            const tri = cross(fig.pts[a], fig.pts[b], fig.pts[c]) > 0 ? [a, b, c] : [a, c, b];
            out.push({ kind, pts: tri, pieces: piecesOf(fig, tri) });
          }
      }
  } else if (kind === "square" || kind === "rectangle") {
    const at = new Map(fig.pts.map((p, i) => [keyOf(p), i]));
    for (let a = 0; a < n; a++)
      for (let c = 0; c < n; c++) {
        const [pa, pc] = [fig.pts[a], fig.pts[c]];
        const [w, h] = [pc[0] - pa[0], pc[1] - pa[1]];
        if (w < EPS || h < EPS || (kind === "square" && Math.abs(w - h) > 1e-6)) continue;
        const b = at.get(keyOf([pc[0], pa[1]]));
        const d = at.get(keyOf([pa[0], pc[1]]));
        if (b === undefined || d === undefined) continue;
        if (on(a, b) && on(b, c) && on(c, d) && on(d, a)) out.push({ kind, pts: [a, b, c, d], pieces: piecesOf(fig, [a, b, c, d]) });
      }
  } else if (kind === "segment") {
    for (const l of fig.lines) for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) out.push({ kind, pts: [l[i], l[j]], pieces: j - i });
  } else if (fig.origin !== undefined) {
    const o = fig.origin;
    const tips: number[] = [];
    for (const l of fig.lines) {
      const k = l.indexOf(o);
      if (k > 0) tips.push(l[0]);
      if (k >= 0 && k < l.length - 1) tips.push(l[l.length - 1]);
    }
    const dir = (t: number) => Math.atan2(fig.pts[t][1] - fig.pts[o][1], fig.pts[t][0] - fig.pts[o][0]);
    tips.sort((a, b) => dir(a) - dir(b));
    for (let i = 0; i < tips.length; i++)
      for (let j = i + 1; j < tips.length; j++) {
        const span = dir(tips[j]) - dir(tips[i]);
        // Only angles under 180°: the rays here all lie on one side.
        if (span > Math.PI - 1e-6) continue;
        out.push({ kind, pts: [tips[i], o, tips[j]], pieces: j - i });
      }
  }

  const c = (s: Shape) => centroid(s.pts.map((i) => fig.pts[i]));
  return out.sort((s, t) => s.pieces - t.pieces || c(t)[1] - c(s)[1] || c(s)[0] - c(t)[0]);
}

export const shapeId = (s: { pts: number[] }) => [...s.pts].sort((a, b) => a - b).join("-");

/** Do these tapped points make a shape of this kind? Returns it, or null. */
export function shapeFromTaps(fig: CountFigure, kind: Kind, taps: number[]): Shape | null {
  const want = new Set(taps);
  if (kind === "angle" && fig.origin !== undefined) want.add(fig.origin);
  const id = [...want].sort((a, b) => a - b).join("-");
  return listShapes(fig, kind).find((s) => shapeId(s) === id) ?? null;
}

/** How many points a child taps to mark one shape. */
export const TAPS: Record<Kind, number> = { triangle: 3, square: 4, rectangle: 4, segment: 2, angle: 2 };

// --- The figure families ---

const H3 = Math.sqrt(3) / 2;

export function figureOf({ family, a, b }: FigureSpec): CountFigure {
  const segs: [Pt, Pt][] = [];
  switch (family) {
    case "grid":
      for (let y = 0; y <= b; y++) segs.push([[0, y], [a, y]]);
      for (let x = 0; x <= a; x++) segs.push([[x, 0], [x, b]]);
      return buildFigure(segs);
    case "fan": {
      const [top, w] = [3.4, 2.4];
      for (let i = 0; i <= a; i++) segs.push([[0, top], [-w + (2 * w * i) / a, 0]]);
      for (let j = 0; j < b; j++) {
        const y = (top * j) / (b + 1);
        const half = w * (1 - y / top);
        segs.push([[-half, y], [half, y]]);
      }
      return buildFigure(segs);
    }
    case "triGrid":
      for (let k = 0; k < a; k++) {
        segs.push([[k / 2, k * H3], [a - k / 2, k * H3]]);
        segs.push([[k, 0], [(a + k) / 2, (a - k) * H3]]);
        segs.push([[k + 1, 0], [(k + 1) / 2, (k + 1) * H3]]);
      }
      return buildFigure(segs);
    case "star": {
      const P = (i: number): Pt => [2 * Math.sin((2 * Math.PI * i) / 5), 2 * Math.cos((2 * Math.PI * i) / 5)];
      for (let i = 0; i < 5; i++) {
        segs.push([P(i), P(i + 2)]);
        if (a) segs.push([P(i), P(i + 1)]);
      }
      return buildFigure(segs);
    }
    case "envelope": {
      const [w, h] = [4, 3];
      segs.push([[0, 0], [w, 0]], [[w, 0], [w, h]], [[w, h], [0, h]], [[0, h], [0, 0]], [[0, 0], [w, h]], [[w, 0], [0, h]]);
      if (a >= 1) segs.push([[w / 2, 0], [w / 2, h]]);
      if (a >= 2) segs.push([[0, h / 2], [w, h / 2]]);
      return buildFigure(segs);
    }
    case "rays": {
      const R = 3;
      const ray = (deg: number): [Pt, Pt] => [[0, 0], [R * Math.cos((deg * Math.PI) / 180), R * Math.sin((deg * Math.PI) / 180)]];
      if (b) {
        segs.push([[-R, 0], [R, 0]]);
        for (let k = 1; k <= a; k++) segs.push(ray((180 * k) / (a + 1)));
      } else for (let k = 0; k < a; k++) segs.push(ray(a === 1 ? 60 : 20 + (140 * k) / (a - 1)));
      return buildFigure(segs, [], [0, 0]);
    }
    case "line": {
      const extra: Pt[] = [];
      // Uneven gaps, so the pieces look like a real drawing.
      const gaps = [1.2, 0.8, 1.4, 1, 0.7, 1.3, 0.9, 1.1];
      let x = 0;
      for (let i = 0; i < a; i++) {
        extra.push([x, 0]);
        if (i < a - 1) x += gaps[i % gaps.length];
      }
      return buildFigure([[[0, 0], [x, 0]]], extra);
    }
  }
}

const counted = new Map<string, number>();

export function countOf(spec: FigureSpec, kind: Kind): number {
  const k = `${spec.family}${spec.a},${spec.b}${kind}`;
  if (!counted.has(k)) counted.set(k, listShapes(figureOf(spec), kind).length);
  return counted.get(k)!;
}

// --- Questions ---

export type CountQuestionType = Kind | "growing";

/** Growing patterns: stage n of each, and what is counted in it. */
export type GrowPattern = "fanTriangles" | "stripRects" | "raysAngles" | "gridSquares" | "triGridTriangles";

export const GROW: Record<GrowPattern, { kind: Kind; stage: (n: number) => FigureSpec }> = {
  fanTriangles: { kind: "triangle", stage: (n) => ({ family: "fan", a: n, b: 1 }) },
  stripRects: { kind: "rectangle", stage: (n) => ({ family: "grid", a: n, b: 1 }) },
  raysAngles: { kind: "angle", stage: (n) => ({ family: "rays", a: n + 1, b: 0 }) },
  gridSquares: { kind: "square", stage: (n) => ({ family: "grid", a: n, b: n }) },
  triGridTriangles: { kind: "triangle", stage: (n) => ({ family: "triGrid", a: n, b: 0 }) },
};

export type CountQuestion =
  | { type: Kind; level: Level; seed: number; spec: FigureSpec; kind: Kind; answer: number }
  | { type: "growing"; level: Level; seed: number; pattern: GrowPattern; kind: Kind; counts: number[]; ask: number; answer: number };

/** Answer ranges by level (the tools map: up to 8, up to 20, then bigger). */
const RANGE: Record<Level, [number, number]> = { 1: [3, 8], 2: [9, 20], 3: [21, 60] };

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/** Every figure that is offered for counting a kind. */
function candidates(kind: Kind): FigureSpec[] {
  const out: FigureSpec[] = [];
  const add = (family: Family, as: number[], bs: number[]) => as.forEach((a) => bs.forEach((b) => out.push({ family, a, b })));
  switch (kind) {
    case "triangle":
      add("fan", range(1, 6), range(1, 3));
      add("triGrid", range(1, 4), [0]);
      add("star", [0, 1], [0]);
      add("envelope", [0, 1, 2], [0]);
      break;
    case "square":
    case "rectangle":
      add("grid", range(1, 5), range(1, 4));
      break;
    case "segment":
      add("line", range(3, 9), [0]);
      add("fan", range(1, 3), [1, 2]);
      add("envelope", [0], [0]);
      add("rays", range(2, 4), [0]);
      break;
    case "angle":
      add("rays", range(2, 9), [0]);
      add("rays", range(1, 7), [1]);
      break;
  }
  return out;
}

const cache = new Map<string, FigureSpec[]>();

/** Figures whose count of a kind falls in the level's range. */
export function figuresFor(kind: Kind, level: Level): FigureSpec[] {
  const k = `${kind}${level}`;
  if (!cache.has(k)) {
    const [lo, hi] = RANGE[level];
    cache.set(
      k,
      candidates(kind).filter((s) => {
        const n = countOf(s, kind);
        // A rectangle question on an all-squares figure would be a square question.
        if (kind === "rectangle" && countOf(s, "square") === n) return false;
        return n >= lo && n <= hi;
      }),
    );
  }
  return cache.get(k)!;
}

const GROW_BY_LEVEL: Record<Level, GrowPattern[]> = {
  1: ["fanTriangles", "stripRects", "raysAngles"],
  2: ["fanTriangles", "stripRects", "raysAngles", "gridSquares"],
  3: ["gridSquares", "triGridTriangles", "fanTriangles", "stripRects"],
};

export function makeCountQuestion(type: CountQuestionType, level: Level, seed: number): CountQuestion {
  const rng: Rng = mulberry32(seed * 31 + level * 7 + type.length);
  if (type === "growing") {
    const pattern = pick(rng, GROW_BY_LEVEL[level]);
    const g = GROW[pattern];
    const ask = level === 1 ? 4 : level === 2 ? 5 : pick(rng, [6, 7]);
    const counts = [1, 2, 3].map((n) => countOf(g.stage(n), g.kind));
    return { type, level, seed, pattern, kind: g.kind, counts, ask, answer: countOf(g.stage(ask), g.kind) };
  }
  const spec = pick(rng, figuresFor(type, level));
  return { type, level, seed, spec, kind: type, answer: countOf(spec, type) };
}

/** The figure a question is about (for growing: the asked stage). */
export const questionSpec = (q: CountQuestion): FigureSpec => (q.type === "growing" ? GROW[q.pattern].stage(q.ask) : q.spec);

export type CountMistake = "right" | "singles" | "noSquares" | "straight" | "linear" | "fewMissed" | "under" | "over";

/** Why a count might be off, from the likely ways of miscounting. */
export function countMistake(q: CountQuestion, n: number): CountMistake {
  if (n === q.answer) return "right";
  if (q.type === "growing") {
    const [, c2, c3] = q.counts;
    if (n === c3 + (c3 - c2) * (q.ask - 3)) return "linear";
  } else {
    const fig = figureOf(q.spec);
    const shapes = listShapes(fig, q.kind);
    if (n === shapes.filter((s) => s.pieces === 1).length) return "singles";
    if (q.kind === "rectangle" && n === q.answer - listShapes(fig, "square").length) return "noSquares";
    if (q.kind === "angle" && n === q.answer + 1 && q.spec.b === 1) return "straight";
  }
  if (n < q.answer && q.answer - n <= Math.max(2, Math.round(q.answer / 8))) return "fewMissed";
  return n < q.answer ? "under" : "over";
}
