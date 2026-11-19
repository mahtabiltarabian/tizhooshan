// Tool 5, "draw it without lifting the pen": a figure is a graph drawn with
// straight lines (points and the lines between them). It can be drawn in one
// stroke, without going over a line twice, exactly when it is connected and
// has 0 or 2 odd points (points where an odd number of line ends meet). With
// 2 odd points the stroke must start at one and ends at the other.
//
// Question figures are drawn on a small lattice with unit steps only
// (sideways, up, or a diagonal of one cell, never both diagonals of a cell),
// so lines meet only at points of the figure.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type SPt = [number, number];
export type Level = 1 | 2 | 3;

export interface StrokeFigure {
  pts: SPt[];
  edges: [number, number][];
}

export function degrees(fig: StrokeFigure): number[] {
  const d = fig.pts.map(() => 0);
  for (const [a, b] of fig.edges) {
    d[a]++;
    d[b]++;
  }
  return d;
}

export const oddPoints = (fig: StrokeFigure) =>
  degrees(fig)
    .map((d, i) => (d % 2 ? i : -1))
    .filter((i) => i >= 0);

export function isConnected(fig: StrokeFigure): boolean {
  const used = new Set(fig.edges.flat());
  if (!used.size) return false;
  const nb = neighbours(fig);
  const start = fig.edges[0][0];
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length)
    for (const w of nb[stack.pop()!])
      if (!seen.has(w)) {
        seen.add(w);
        stack.push(w);
      }
  return [...used].every((v) => seen.has(v));
}

const neighbours = (fig: StrokeFigure) => {
  const nb: number[][] = fig.pts.map(() => []);
  for (const [a, b] of fig.edges) {
    nb[a].push(b);
    nb[b].push(a);
  }
  return nb;
};

/** Can it be drawn in one stroke? */
export const drawable = (fig: StrokeFigure) => isConnected(fig) && oddPoints(fig).length <= 2;

/**
 * Pairs of lines that go straight through a point. A child who counts
 * "lines through the point" instead of "line ends at the point" counts each
 * such pair once: a T-junction looks like 2 lines, not 3 ends.
 */
export function straightPairs(fig: StrokeFigure, v: number): number {
  const dirs = fig.edges
    .filter((e) => e.includes(v))
    .map(([a, b]) => {
      const w = a === v ? b : a;
      return Math.atan2(fig.pts[w][1] - fig.pts[v][1], fig.pts[w][0] - fig.pts[v][0]);
    });
  const used = new Set<number>();
  let pairs = 0;
  for (let i = 0; i < dirs.length; i++)
    for (let j = i + 1; j < dirs.length; j++) {
      if (used.has(i) || used.has(j)) continue;
      const diff = Math.abs(Math.abs(dirs[i] - dirs[j]) - Math.PI);
      if (diff < 1e-6) {
        used.add(i);
        used.add(j);
        pairs++;
      }
    }
  return pairs;
}

/** Odd points as a child counting lines through each point would see them. */
export const linesOddPoints = (fig: StrokeFigure) => {
  const d = degrees(fig);
  return fig.pts.map((_, i) => i).filter((i) => d[i] > 0 && (d[i] - straightPairs(fig, i)) % 2 === 1);
};

/**
 * One stroke over every line once (as the points visited), starting at
 * `start` (default: an odd point, else the first point used), or null.
 */
export function eulerPath(fig: StrokeFigure, start?: number): number[] | null {
  if (!isConnected(fig)) return null;
  const odd = oddPoints(fig);
  if (odd.length > 2) return null;
  const s = start ?? (odd.length ? odd[0] : fig.edges[0][0]);
  if (odd.length === 2 && !odd.includes(s)) return null;
  if (!fig.edges.some((e) => e.includes(s))) return null;
  // Hierholzer, taking the lowest-numbered free line first so it is repeatable.
  const adj: { to: number; e: number }[][] = fig.pts.map(() => []);
  fig.edges.forEach(([a, b], e) => {
    adj[a].push({ to: b, e });
    adj[b].push({ to: a, e });
  });
  const used = new Array(fig.edges.length).fill(false);
  const ptr = fig.pts.map(() => 0);
  const stack = [s];
  const path: number[] = [];
  while (stack.length) {
    const v = stack[stack.length - 1];
    while (ptr[v] < adj[v].length && used[adj[v][ptr[v]].e]) ptr[v]++;
    if (ptr[v] === adj[v].length) path.push(stack.pop()!);
    else {
      const { to, e } = adj[v][ptr[v]];
      used[e] = true;
      stack.push(to);
    }
  }
  return path.length === fig.edges.length + 1 ? path.reverse() : null;
}

/** Index of the line between two points, or −1. */
export const edgeBetween = (fig: StrokeFigure, a: number, b: number) => fig.edges.findIndex(([p, q]) => (p === a && q === b) || (p === b && q === a));

/** Checks a stroke (points visited) uses every line exactly once. */
export function isStroke(fig: StrokeFigure, path: number[]): boolean {
  if (path.length !== fig.edges.length + 1) return false;
  const used = new Set<number>();
  for (let i = 0; i + 1 < path.length; i++) {
    const e = edgeBetween(fig, path[i], path[i + 1]);
    if (e < 0 || used.has(e)) return false;
    used.add(e);
  }
  return used.size === fig.edges.length;
}

/** Lines cross or touch only at shared end points, and no point sits inside a line. */
export function cleanDrawing(fig: StrokeFigure): boolean {
  const P = fig.pts;
  const cr = (o: SPt, a: SPt, b: SPt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const onSeg = (p: SPt, a: SPt, b: SPt) =>
    Math.abs(cr(a, b, p)) < 1e-9 && Math.min(a[0], b[0]) - 1e-9 <= p[0] && p[0] <= Math.max(a[0], b[0]) + 1e-9 && Math.min(a[1], b[1]) - 1e-9 <= p[1] && p[1] <= Math.max(a[1], b[1]) + 1e-9;
  const used = [...new Set(fig.edges.flat())];
  for (let i = 0; i < fig.edges.length; i++) {
    const [a, b] = fig.edges[i];
    if (a === b) return false;
    for (const v of used) if (v !== a && v !== b && onSeg(P[v], P[a], P[b])) return false;
    for (let j = i + 1; j < fig.edges.length; j++) {
      const [c, d] = fig.edges[j];
      if ((a === c && b === d) || (a === d && b === c)) return false;
      const shared = [a, b].filter((x) => x === c || x === d).length;
      if (shared) continue;
      const d1 = cr(P[a], P[b], P[c]);
      const d2 = cr(P[a], P[b], P[d]);
      const d3 = cr(P[c], P[d], P[a]);
      const d4 = cr(P[c], P[d], P[b]);
      if (d1 * d2 < -1e-12 && d3 * d4 < -1e-12) return false;
    }
  }
  return true;
}

// --- Named figures for exploring ---

const P5 = (i: number, r: number): SPt => [r * Math.sin((2 * Math.PI * i) / 5), r * Math.cos((2 * Math.PI * i) / 5)];

/** Five-pointed star with its five crossings as points. */
function star(): StrokeFigure {
  const tips = [0, 1, 2, 3, 4].map((i) => P5(i, 2));
  // Inner crossings sit at the inner pentagon, turned half a step.
  const rIn = 2 * Math.cos((2 * Math.PI) / 5) / Math.cos(Math.PI / 5);
  const inner = [0, 1, 2, 3, 4].map((i) => P5(i + 0.5, rIn));
  const pts = [...tips, ...inner];
  const edges: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    // Tip i to the two crossings next to it.
    edges.push([i, 5 + i], [i, 5 + ((i + 4) % 5)]);
    // Crossing i to crossing i+1 (the inner pentagon).
    edges.push([5 + i, 5 + ((i + 1) % 5)]);
  }
  return { pts, edges };
}

export type NamedFigure = "house" | "houseX" | "envelope" | "bow" | "window2" | "window4" | "kite" | "star";

export const NAMED: Record<NamedFigure, () => StrokeFigure> = {
  house: () => ({ pts: [[0, 0], [2, 0], [2, 2], [0, 2], [1, 3]], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 3]] }),
  houseX: () => ({
    pts: [[0, 0], [2, 0], [2, 2], [0, 2], [1, 3], [1, 1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 3], [0, 5], [5, 2], [1, 5], [5, 3]],
  }),
  envelope: () => ({
    pts: [[0, 0], [3, 0], [3, 2], [0, 2], [1.5, 1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 2], [1, 4], [4, 3]],
  }),
  bow: () => ({ pts: [[0, 0], [0, 2], [1.5, 1], [3, 0], [3, 2]], edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 2]] }),
  window2: () => ({
    pts: [[0, 0], [1.5, 0], [3, 0], [3, 2], [1.5, 2], [0, 2]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4]],
  }),
  window4: () => ({
    pts: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
    edges: [[0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [0, 3], [3, 6], [1, 4], [4, 7], [2, 5], [5, 8]],
  }),
  kite: () => ({ pts: [[1, 0], [2, 2], [1, 3], [0, 2]], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 1]] }),
  star,
};

// --- Random lattice figures ---

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Every line a lattice figure may use: unit steps and cell diagonals. */
function latticeLines(w: number, h: number) {
  const id = (x: number, y: number) => y * w + x;
  const lines: { a: number; b: number; cell?: number }[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x + 1 < w) lines.push({ a: id(x, y), b: id(x + 1, y) });
      if (y + 1 < h) lines.push({ a: id(x, y), b: id(x, y + 1) });
      if (x + 1 < w && y + 1 < h) {
        const cell = id(x, y);
        lines.push({ a: id(x, y), b: id(x + 1, y + 1), cell }, { a: id(x + 1, y), b: id(x, y + 1), cell });
      }
    }
  return lines;
}

/** Drops unused points and numbers the rest, keeping their places. */
function compact(pts: SPt[], edges: [number, number][]): StrokeFigure {
  const map = new Map<number, number>();
  const out: SPt[] = [];
  for (const e of edges)
    for (const v of e)
      if (!map.has(v)) {
        map.set(v, out.length);
        out.push(pts[v]);
      }
  return { pts: out, edges: edges.map(([a, b]) => [map.get(a)!, map.get(b)!]) };
}

/**
 * A connected lattice figure with exactly `odd` odd points and about `size`
 * lines. Starts from a random tree plus a few lines, then toggles lines
 * between pairs of points to fix the number of odd points.
 */
export function latticeFigure(rng: Rng, w: number, h: number, size: number, odd: number, diagonals: boolean): StrokeFigure | null {
  const pts: SPt[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pts.push([x, y]);
  const all = latticeLines(w, h).filter((l) => diagonals || l.cell === undefined);
  const on = new Set<string>();
  const cellUsed = new Map<number, string>();
  const can = (l: (typeof all)[number]) => l.cell === undefined || !cellUsed.has(l.cell) || cellUsed.get(l.cell) === key(l.a, l.b);
  const add = (l: (typeof all)[number]) => {
    on.add(key(l.a, l.b));
    if (l.cell !== undefined) cellUsed.set(l.cell, key(l.a, l.b));
  };
  const remove = (l: (typeof all)[number]) => {
    on.delete(key(l.a, l.b));
    if (l.cell !== undefined) cellUsed.delete(l.cell);
  };
  const fig = () => compact(pts, all.filter((l) => on.has(key(l.a, l.b))).map((l) => [l.a, l.b] as [number, number]));

  // Grow a random connected tree from a random point.
  const inTree = new Set([randInt(rng, pts.length)]);
  const treeSize = Math.min(pts.length, Math.max(3, Math.round(size * 0.7)));
  for (let guard = 0; inTree.size < treeSize && guard < 500; guard++) {
    const frontier = all.filter((l) => can(l) && inTree.has(l.a) !== inTree.has(l.b));
    if (!frontier.length) break;
    const l = pick(rng, frontier);
    add(l);
    inTree.add(l.a);
    inTree.add(l.b);
  }
  // Extra lines between points already drawn (they keep it connected).
  for (let guard = 0; on.size < size && guard < 200; guard++) {
    const free = all.filter((l) => !on.has(key(l.a, l.b)) && can(l) && inTree.has(l.a) && inTree.has(l.b));
    if (!free.length) break;
    add(pick(rng, free));
  }

  // Fix the number of odd points by toggling lines.
  for (let guard = 0; guard < 60; guard++) {
    const f = fig();
    const n = oddPoints(f).length;
    if (n === odd && isConnected(f)) return f;
    const deg = new Map<number, number>();
    for (const l of all)
      if (on.has(key(l.a, l.b))) {
        deg.set(l.a, (deg.get(l.a) ?? 0) + 1);
        deg.set(l.b, (deg.get(l.b) ?? 0) + 1);
      }
    const isOdd = (v: number) => (deg.get(v) ?? 0) % 2 === 1;
    const touched = (v: number) => (deg.get(v) ?? 0) > 0;
    // Fewer odd points: toggle a line between two odd points; more: between two even drawn points.
    const want = n > odd ? (l: (typeof all)[number]) => isOdd(l.a) && isOdd(l.b) : (l: (typeof all)[number]) => touched(l.a) && touched(l.b) && !isOdd(l.a) && !isOdd(l.b);
    const moves = shuffle(rng, all.filter(want));
    let moved = false;
    for (const l of moves) {
      if (on.has(key(l.a, l.b))) {
        remove(l);
        if (isConnected(fig())) {
          moved = true;
          break;
        }
        add(l);
      } else if (can(l)) {
        add(l);
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }
  return null;
}

// --- Questions ---

/** which: pick the figure that can be drawn; count: how many odd points; start/end: where the stroke starts or ends. */
export type StrokeAsk = "which" | "count" | "start" | "end";

export type StrokeTag =
  | "fourOdd" // the figure has 4 odd points
  | "manyOdd" // 6 or more odd points
  | "countLines" // counted lines through a point, not line ends
  | "evenStart" // started at an even point
  | "evenEnd" // a stroke cannot end at an even point
  | "backToStart" // with 2 odd points the stroke does not come back
  | "countedEven" // counted the even points
  | "countedAll"; // counted every point

export type StrokeQuestion =
  | { type: "stroke"; level: Level; seed: number; ask: "which"; options: StrokeFigure[]; mistakes: (StrokeTag | null)[]; answer: number }
  | { type: "stroke"; level: Level; seed: number; ask: "count"; fig: StrokeFigure; answer: number }
  | { type: "stroke"; level: Level; seed: number; ask: "start"; fig: StrokeFigure; choices: number[]; mistakes: (StrokeTag | null)[]; answer: number }
  | { type: "stroke"; level: Level; seed: number; ask: "end"; fig: StrokeFigure; from: number; choices: number[]; mistakes: (StrokeTag | null)[]; answer: number };

/** Persian letters that name points. */
export const POINT_NAMES = ["الف", "ب", "پ", "ت", "ث", "ج", "چ", "ح", "خ", "د", "ر", "ز", "س", "ش", "ص", "ط"];

const SETUP: Record<Level, { w: number; h: number; size: [number, number]; diagonals: boolean }> = {
  1: { w: 3, h: 3, size: [6, 9], diagonals: false },
  2: { w: 4, h: 3, size: [9, 13], diagonals: true },
  3: { w: 4, h: 3, size: [8, 12], diagonals: true },
};

/** Why a wrong figure might look drawable. */
export function figureTag(fig: StrokeFigure): StrokeTag | null {
  if (drawable(fig)) return null;
  if (linesOddPoints(fig).length <= 2) return "countLines";
  return oddPoints(fig).length === 4 ? "fourOdd" : "manyOdd";
}

function build(rng: Rng, level: Level, odd: number, evenPoints = 0): StrokeFigure {
  const s = SETUP[level];
  for (let tries = 0; tries < 200; tries++) {
    const size = s.size[0] + randInt(rng, s.size[1] - s.size[0] + 1);
    const f = latticeFigure(rng, s.w, s.h, size, odd, s.diagonals);
    // At least one closed loop (more lines than points − 1), so it looks like a figure, not a branch.
    if (f && f.edges.length >= s.size[0] - 1 && f.edges.length >= f.pts.length && f.pts.length - odd >= evenPoints) return f;
  }
  throw new Error("no figure");
}

export function makeStrokeQuestion(level: Level, seed: number): StrokeQuestion {
  const rng = mulberry32(seed * 13 + level * 101 + 5);
  const ask: StrokeAsk = level < 3 ? "which" : pick(rng, ["count", "start", "end"] as const);

  if (ask === "which") {
    const right = build(rng, level, pick(rng, [0, 2, 2]));
    // Level 1: wrong ones have 4 odd points; level 2 mixes in 6.
    const wrongOdd = level === 1 ? [4, 4, 4] : shuffle(rng, [4, 4, 6]);
    const wrong = wrongOdd.map((n) => build(rng, level, n));
    const all = [right, ...wrong];
    const order = shuffle(rng, [0, 1, 2, 3]);
    const options = order.map((i) => all[i]);
    return { type: "stroke", level, seed, ask, options, mistakes: options.map(figureTag), answer: order.indexOf(0) };
  }

  if (ask === "count") {
    const fig = build(rng, level, pick(rng, [2, 4, 4, 6]));
    return { type: "stroke", level, seed, ask, fig, answer: oddPoints(fig).length };
  }

  const fig = build(rng, level, 2, 3);
  const odd = oddPoints(fig);
  const even = shuffle(
    rng,
    degrees(fig)
      .map((d, i) => (d % 2 === 0 ? i : -1))
      .filter((i) => i >= 0),
  );
  const [a, b] = shuffle(rng, odd);
  if (ask === "start") {
    // One odd point among three even ones: only it can be the start.
    const pool = [{ v: a, tag: null }, ...even.slice(0, 3).map((v) => ({ v, tag: "evenStart" as const }))];
    const order = shuffle(rng, pool.map((_, i) => i));
    return { type: "stroke", level, seed, ask, fig, choices: order.map((i) => pool[i].v), mistakes: order.map((i) => pool[i].tag), answer: order.indexOf(0) };
  }
  const pool = [{ v: b, tag: null }, { v: a, tag: "backToStart" as const }, ...even.slice(0, 2).map((v) => ({ v, tag: "evenEnd" as const }))];
  const order = shuffle(rng, pool.map((_, i) => i));
  return { type: "stroke", level, seed, ask, fig, from: a, choices: order.map((i) => pool[i].v), mistakes: order.map((i) => pool[i].tag), answer: order.indexOf(0) };
}

/** The usual wrong counts of odd points, by tag. */
export function countSlips(fig: StrokeFigure): [StrokeTag, number][] {
  const d = degrees(fig);
  const used = d.filter((x) => x > 0).length;
  const odd = oddPoints(fig).length;
  return [
    ["countLines", linesOddPoints(fig).length],
    ["countedEven", used - odd],
    ["countedAll", used],
  ];
}

/** Which slip a count of odd points is, if any. */
export function countSlip(q: Extract<StrokeQuestion, { ask: "count" }>, n: number): StrokeTag | null {
  if (n === q.answer) return null;
  for (const [tag, v] of countSlips(q.fig)) if (v !== q.answer && v === n) return tag;
  return null;
}

/** Names of the choice points (letters), in order of the points. */
export function pointNames(q: StrokeQuestion): Map<number, string> {
  const m = new Map<number, string>();
  if (q.ask === "start" || q.ask === "end") {
    const named = q.ask === "end" ? [q.from, ...q.choices.filter((c) => c !== q.from)] : q.choices;
    named.forEach((v, i) => m.set(v, POINT_NAMES[i]));
  }
  return m;
}
