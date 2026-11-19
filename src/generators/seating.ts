// Tool 20: seating and family trees. Five arrangements (a queue, a ranking by
// height, age or score, the floors of a building, a round table and a
// rectangular table) and family trees.
//
// An arrangement is `seatOf[person] = seat`. Linear arrangements number their
// places from the "first" one: the front of the queue, the tallest, the top
// floor. Tables number their seats clockwise as drawn (seat 0 at the top), and
// everyone faces the table, so a sitter's right hand points to the previous
// seat and the left hand to the next one.
//
// Generation: pick a hidden arrangement, list every condition that is true of
// it, add them in a weighted random order while each one still rules some
// arrangements out, until one arrangement is left (or, for a single question,
// until the asked answer is the same in every arrangement left). Then drop
// the conditions the others already imply, and order the rest so that each
// one rules out as much as it can (the "show me" order). A round table counts
// rotations as the same: one person's seat is fixed and given.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type SeatKind = "queue" | "rank" | "floors" | "round" | "rect";
export type SeatingType = SeatKind | "family";
export type RankAttr = "height" | "age" | "score";

export const SEAT_KINDS: SeatKind[] = ["queue", "rank", "floors", "round", "rect"];
export const isLinear = (k: SeatKind) => k === "queue" || k === "rank" || k === "floors";

/** People counts each arrangement allows. A rectangular table has 2 + 2 seats, or 2 + 2 and one at each end. */
export const SIZES: Record<SeatKind, number[]> = {
  queue: [4, 5, 6, 7],
  rank: [4, 5, 6, 7],
  floors: [4, 5, 6, 7],
  round: [4, 5, 6, 7],
  rect: [4, 6],
};

// Common, gender-clear first names, short enough for a seat label.
export const BOYS = ["علی", "رضا", "حسین", "محمد", "امیر", "سینا", "آرش", "کیان", "بابک", "پویا", "نیما", "مهدی", "حامد", "سامان", "بهرام", "کاوه"];
export const GIRLS = ["سارا", "مریم", "زهرا", "نازنین", "الهام", "نگار", "مینا", "رویا", "شیما", "لیلا", "پریا", "یاسمن", "ترانه", "هستی", "نرگس", "فاطمه"];

// ─── Layouts ────────────────────────────────────────────────────────────────

export interface Layout {
  kind: SeatKind;
  n: number;
  /** Tables: the seat at a sitter's right hand, left hand, across the table (-1: none). */
  R: number[];
  L: number[];
  O: number[];
  /** Rectangular table: 0 window side, 1 door side, 2 an end ("head"). */
  side: number[];
  /** The seat each seat becomes in a mirror (left and right, or front and back, swapped). */
  mirror: number[];
}

const layouts = new Map<string, Layout>();

export function layoutOf(kind: SeatKind, n: number): Layout {
  const key = `${kind}${n}`;
  const hit = layouts.get(key);
  if (hit) return hit;
  const none = Array(n).fill(-1);
  let lay: Layout;
  if (isLinear(kind)) {
    lay = { kind, n, R: none, L: none, O: none, side: none, mirror: Array.from({ length: n }, (_, s) => n - 1 - s) };
  } else if (kind === "round") {
    lay = {
      kind,
      n,
      R: Array.from({ length: n }, (_, s) => (s - 1 + n) % n),
      L: Array.from({ length: n }, (_, s) => (s + 1) % n),
      O: Array.from({ length: n }, (_, s) => (n % 2 ? -1 : (s + n / 2) % n)),
      side: none,
      // Seat 0 stays: it is the fixed seat at the top.
      mirror: Array.from({ length: n }, (_, s) => (n - s) % n),
    };
  } else if (n === 4) {
    // Window side 0, 1 (left to right as drawn), door side 2, 3 (right to left).
    lay = { kind, n, R: [-1, 0, -1, 2], L: [1, -1, 3, -1], O: [3, 2, 1, 0], side: [0, 0, 1, 1], mirror: [1, 0, 3, 2] };
  } else {
    // Window 0, 1; right end 2; door 3, 4 (right to left); left end 5. A ring of six.
    lay = {
      kind,
      n,
      R: [5, 0, 1, 2, 3, 4],
      L: [1, 2, 3, 4, 5, 0],
      O: [4, 3, 5, 1, 0, 2],
      side: [0, 0, 2, 1, 1, 2],
      mirror: [1, 0, 5, 4, 3, 2],
    };
  }
  layouts.set(key, lay);
  return lay;
}

// ─── Permutations ───────────────────────────────────────────────────────────

const permCache = new Map<number, Int8Array>();

/** All n! arrangements, flat: arrangement i gives person j seat `perms[i * n + j]`. */
export function permsOf(n: number): Int8Array {
  const hit = permCache.get(n);
  if (hit) return hit;
  let count = 1;
  for (let i = 2; i <= n; i++) count *= i;
  const out = new Int8Array(count * n);
  const a = Array.from({ length: n }, (_, i) => i);
  let k = 0;
  const rec = (i: number) => {
    if (i === n) {
      out.set(a, k * n);
      k++;
      return;
    }
    for (let j = i; j < n; j++) {
      [a[i], a[j]] = [a[j], a[i]];
      rec(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
  };
  rec(0);
  permCache.set(n, out);
  return out;
}

// ─── Conditions ─────────────────────────────────────────────────────────────

export type Cond =
  /** Linear: a is in place p (0 = first). */
  | { k: "at"; a: number; p: number }
  /** Linear: a is neither first nor last. */
  | { k: "notEnd"; a: number }
  /** Linear: a is right before b (in front of, one taller than, one floor above). */
  | { k: "justAhead"; a: number; b: number }
  /** Linear: a is somewhere before b. */
  | { k: "ahead"; a: number; b: number }
  | { k: "adjacent"; a: number; b: number }
  | { k: "notAdjacent"; a: number; b: number }
  /** Linear: a and b are d places apart (d − 1 people between them). */
  | { k: "apart"; a: number; b: number; d: number }
  /** a is between b and c (tables: b and c are a's two neighbours). */
  | { k: "between"; a: number; b: number; c: number }
  /** Tables: a sits at b's right hand / left hand / two seats to b's right. */
  | { k: "right"; a: number; b: number }
  | { k: "left"; a: number; b: number }
  | { k: "right2"; a: number; b: number }
  | { k: "opposite"; a: number; b: number }
  /** Rectangular table: a sits on the window side (0) or door side (1). */
  | { k: "side"; a: number; s: 0 | 1 }
  /** Rectangular table: a sits at an end. */
  | { k: "head"; a: number };

export type CondKind = Cond["k"];

/** People a condition is about. */
export function condPeople(c: Cond): number[] {
  return "c" in c ? [c.a, c.b, c.c] : "b" in c ? [c.a, c.b] : [c.a];
}

/** Whether a condition holds; person i sits at seat `seat[off + i]`. */
export function holds(c: Cond, seat: ArrayLike<number>, off: number, lay: Layout): boolean {
  const sa = seat[off + c.a];
  switch (c.k) {
    case "at":
      return sa === c.p;
    case "notEnd":
      return sa !== 0 && sa !== lay.n - 1;
    case "head":
      return lay.side[sa] === 2;
    case "side":
      return lay.side[sa] === c.s;
  }
  const sb = seat[off + c.b];
  switch (c.k) {
    case "justAhead":
      return sa === sb - 1;
    case "ahead":
      return sa < sb;
    case "adjacent":
    case "notAdjacent": {
      const adj = isLinear(lay.kind) ? Math.abs(sa - sb) === 1 : lay.R[sa] === sb || lay.L[sa] === sb;
      return c.k === "adjacent" ? adj : !adj;
    }
    case "apart":
      return Math.abs(sa - sb) === c.d;
    case "right":
      return sa === lay.R[sb];
    case "left":
      return sa === lay.L[sb];
    case "right2":
      return lay.R[sb] >= 0 && sa === lay.R[lay.R[sb]];
    case "opposite":
      return lay.O[sb] === sa;
    case "between": {
      const sc = seat[off + c.c];
      if (isLinear(lay.kind)) return (sb < sa && sa < sc) || (sc < sa && sa < sb);
      return (lay.R[sa] === sb && lay.L[sa] === sc) || (lay.R[sa] === sc && lay.L[sa] === sb);
    }
  }
}

/** Live check for a partial arrangement (-1 = not placed): null until everyone in it is placed. */
export function checkCond(c: Cond, seatOf: readonly number[], lay: Layout): boolean | null {
  if (condPeople(c).some((p) => seatOf[p] < 0)) return null;
  return holds(c, seatOf, 0, lay);
}

/** Every condition of the templates true for the arrangement `s` (seat of each person). */
function truths(lay: Layout, s: readonly number[], level: Level): { c: Cond; w: number }[] {
  const { n, kind } = lay;
  const out: { c: Cond; w: number }[] = [];
  const add = (c: Cond, w: number) => w > 0 && out.push({ c, w });
  const L1 = level === 1;
  const L3 = level === 3;
  const who = Array(n);
  s.forEach((seat, p) => (who[seat] = p));
  if (isLinear(kind)) {
    const rank = kind === "rank";
    for (let a = 0; a < n; a++) {
      const end = s[a] === 0 || s[a] === n - 1;
      add({ k: "at", a, p: s[a] }, end ? (L1 ? 3 : L3 ? 0.8 : 2) : L1 ? 2 : L3 ? 0.3 : 1);
      if (!end && !L1) add({ k: "notEnd", a }, 1);
      for (let b = 0; b < n; b++) {
        if (a === b) continue;
        const d = s[b] - s[a];
        if (d === 1) add({ k: "justAhead", a, b }, L3 ? 2 : 3);
        if (d > 0 && !L1) add({ k: "ahead", a, b }, rank ? 2.5 : 1.5);
        if (a < b && !rank) {
          if (Math.abs(d) === 1) add({ k: "adjacent", a, b }, 1.5);
          else if (!L1) add({ k: "notAdjacent", a, b }, 1);
        }
        if (a < b && Math.abs(d) >= 2 && !L1) add({ k: "apart", a, b, d: Math.abs(d) }, 1.5);
      }
      // a between b and c, b before c.
      if (!L1)
        for (let b = 0; b < n; b++)
          for (let c = 0; c < n; c++) if (s[b] < s[a] && s[a] < s[c] && (s[c] - s[b] > 2 || L3)) add({ k: "between", a, b, c }, L3 ? 1.5 : 0.5);
    }
    return out;
  }
  for (let a = 0; a < n; a++) {
    const sa = s[a];
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const sb = s[b];
      if (sa === lay.R[sb]) add({ k: "right", a, b }, 3);
      if (sa === lay.L[sb]) add({ k: "left", a, b }, 3);
      if (a < b) {
        const adj = lay.R[sa] === sb || lay.L[sa] === sb;
        if (adj) add({ k: "adjacent", a, b }, 1.5);
        else if (!L1) add({ k: "notAdjacent", a, b }, 1);
        if (lay.O[sa] === sb) add({ k: "opposite", a, b }, 2.5);
      }
      if (L3 && n >= 5 && lay.R[sb] >= 0 && lay.R[lay.R[sb]] === sa) add({ k: "right2", a, b }, 1);
    }
    if (!L1 && lay.R[sa] >= 0 && lay.L[sa] >= 0) {
      add({ k: "between", a, b: who[lay.R[sa]], c: who[lay.L[sa]] }, 1.5);
    }
    if (kind === "rect") {
      if (lay.side[sa] === 2) add({ k: "head", a }, 2);
      else add({ k: "side", a, s: lay.side[sa] as 0 | 1 }, 2);
    }
  }
  return out;
}

// ─── Bit sets over the arrangements still possible ─────────────────────────

const colCache = new Map<string, Int8Array[]>();

/** Seat of each person in each starting arrangement: `cols[person][i]`. */
function columnsOf(n: number, fixed: number | null, valid: Int32Array): Int8Array[] {
  const key = `${n}:${fixed}`;
  const hit = colCache.get(key);
  if (hit) return hit;
  const perms = permsOf(n);
  const cols = Array.from({ length: n }, () => new Int8Array(valid.length));
  for (let i = 0; i < valid.length; i++) for (let p = 0; p < n; p++) cols[p][i] = perms[valid[i] * n + p];
  colCache.set(key, cols);
  return cols;
}

/**
 * Which starting arrangements keep a condition, as a bit set. The same test
 * as `holds`, written as one tight loop per kind: the generator runs it over
 * up to 5040 arrangements for every condition it tries.
 */
function maskOf(c: Cond, lay: Layout, cols: Int8Array[]): Uint32Array {
  const total = cols[0].length;
  const m = new Uint32Array((total + 31) >> 5);
  const { R, L, O, side, n } = lay;
  const A = cols[c.a];

  const linear = isLinear(lay.kind);
  switch (c.k) {
    case "at":
      for (let i = 0; i < total; i++) if (A[i] === c.p) m[i >> 5] |= 1 << (i & 31);
      return m;
    case "notEnd":
      for (let i = 0; i < total; i++) if (A[i] !== 0 && A[i] !== n - 1) m[i >> 5] |= 1 << (i & 31);
      return m;
    case "head":
      for (let i = 0; i < total; i++) if (side[A[i]] === 2) m[i >> 5] |= 1 << (i & 31);
      return m;
    case "side":
      for (let i = 0; i < total; i++) if (side[A[i]] === c.s) m[i >> 5] |= 1 << (i & 31);
      return m;
  }
  const B = cols[c.b];
  switch (c.k) {
    case "justAhead":
      for (let i = 0; i < total; i++) if (A[i] === B[i] - 1) m[i >> 5] |= 1 << (i & 31);
      break;
    case "ahead":
      for (let i = 0; i < total; i++) if (A[i] < B[i]) m[i >> 5] |= 1 << (i & 31);
      break;
    case "adjacent":
    case "notAdjacent": {
      const want = c.k === "adjacent";
      for (let i = 0; i < total; i++) {
        const adj = linear ? A[i] - B[i] === 1 || B[i] - A[i] === 1 : R[A[i]] === B[i] || L[A[i]] === B[i];
        if (adj === want) m[i >> 5] |= 1 << (i & 31);
      }
      break;
    }
    case "apart":
      for (let i = 0; i < total; i++) if (A[i] - B[i] === c.d || B[i] - A[i] === c.d) m[i >> 5] |= 1 << (i & 31);
      break;
    case "right":
      for (let i = 0; i < total; i++) if (A[i] === R[B[i]]) m[i >> 5] |= 1 << (i & 31);
      break;
    case "left":
      for (let i = 0; i < total; i++) if (A[i] === L[B[i]]) m[i >> 5] |= 1 << (i & 31);
      break;
    case "right2":
      for (let i = 0; i < total; i++) if (R[B[i]] >= 0 && A[i] === R[R[B[i]]]) m[i >> 5] |= 1 << (i & 31);
      break;
    case "opposite":
      for (let i = 0; i < total; i++) if (O[B[i]] === A[i]) m[i >> 5] |= 1 << (i & 31);
      break;
    case "between": {
      const C = cols[c.c];
      for (let i = 0; i < total; i++) {
        const x = A[i];
        const y = B[i];
        const z = C[i];
        if (linear ? (y < x && x < z) || (z < x && x < y) : (R[x] === y && L[x] === z) || (R[x] === z && L[x] === y)) m[i >> 5] |= 1 << (i & 31);
      }
      break;
    }
  }
  return m;
}

function popcount(x: number) {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function andAll(masks: readonly Uint32Array[], words: number, total: number): Uint32Array {
  const m = new Uint32Array(words);
  for (let w = 0; w < words; w++) m[w] = 0xffffffff;
  // Trim the bits past the end.
  if (total & 31) m[words - 1] = (1 << (total & 31)) - 1;
  for (const x of masks) for (let w = 0; w < words; w++) m[w] &= x[w];
  return m;
}

function bitsOf(m: Uint32Array): number[] {
  const out: number[] = [];
  for (let w = 0; w < m.length; w++) {
    let x = m[w];
    while (x) {
      const b = 31 - Math.clz32(x & -x);
      out.push(w * 32 + b);
      x &= x - 1;
    }
  }
  return out;
}

// ─── Questions about one seat ──────────────────────────────────────────────

/**
 * at: who is in place p? prev / next: who is right before / after `of` (in
 * front of, one floor above; behind, one floor below)? right / left /
 * opposite: who sits at `of`'s right hand, left hand, across the table?
 */
export type Ask = { rel: "at"; p: number } | { rel: "prev" | "next" | "right" | "left" | "opposite"; of: number };

/** The seat an ask points at, given where everyone sits (-1: no such seat). */
export function askSeat(ask: Ask, seat: ArrayLike<number>, off: number, lay: Layout): number {
  if (ask.rel === "at") return ask.p;
  const s = seat[off + ask.of];
  switch (ask.rel) {
    case "prev":
      return s - 1;
    case "next":
      return s + 1 < lay.n ? s + 1 : -1;
    case "right":
      return lay.R[s];
    case "left":
      return lay.L[s];
    case "opposite":
      return lay.O[s];
  }
}

// ─── Arrangement puzzles ───────────────────────────────────────────────────

export interface Arrangement {
  kind: SeatKind;
  n: number;
  names: string[];
  /** Ranking: by height, age or score. */
  attr: RankAttr;
  /** Round table: whose seat (seat 0, at the top) is given. */
  fixed: number | null;
  /** In "show me" order. */
  conds: Cond[];
  /** The hidden arrangement: seat of each person. */
  solution: number[];
}

const validCache = new Map<string, Int32Array>();

/** Arrangements a puzzle starts from: all of them, or (round table) those with the fixed person in seat 0. */
function validOf(kind: SeatKind, n: number, fixed: number | null): Int32Array {
  const key = `${n}:${fixed}`;
  const hit = validCache.get(key);
  if (hit) return hit;
  const perms = permsOf(n);
  const total = perms.length / n;
  const out = new Int32Array(fixed === null ? total : total / n);
  let k = 0;
  for (let i = 0; i < total; i++) if (fixed === null || perms[i * n + fixed] === 0) out[k++] = i;
  validCache.set(key, out);
  return out;
}

export const levelForSize = (n: number): Level => (n <= 4 ? 1 : n <= 6 ? 2 : 3);
export const capOf = (level: Level) => (level === 1 ? 6 : level === 2 ? 7 : 9);
/** Tries for a short enough list of conditions. */
const ATTEMPTS = 4;

const countOf = (m: Uint32Array) => {
  let k = 0;
  for (let w = 0; w < m.length; w++) k += popcount(m[w]);
  return k;
};

/** Done when one arrangement is left. */
const one = (left: Uint32Array) => countOf(left) <= 1;

/**
 * Conditions true of the hidden arrangement, enough that `done` holds of the
 * arrangements left (a bit set over the starting ones), none implied by the
 * others, strongest first.
 */
function buildConds(
  rng: Rng,
  lay: Layout,
  cols: Int8Array[],
  hidden: readonly number[],
  level: Level,
  done: (left: Uint32Array) => boolean,
  exclude: (c: Cond) => boolean,
): Cond[] {
  const total = cols[0].length;
  const words = (total + 31) >> 5;
  const pool = truths(lay, hidden, level).filter((t) => !exclude(t.c));
  // Weighted random order (Efraimidis–Spirakis keys).
  const order = pool.map((t) => ({ c: t.c, key: Math.pow(rng(), 1 / t.w) })).sort((x, y) => y.key - x.key);
  let left = andAll([], words, total);
  let count = total;
  const chosen: Cond[] = [];
  const masks: Uint32Array[] = [];
  for (const { c } of order) {
    if (done(left)) break;
    const m = maskOf(c, lay, cols);
    const next = andAll([left, m], words, total);
    const k = countOf(next);
    if (k < count) {
      chosen.push(c);
      masks.push(m);
      left = next;
      count = k;
    }
  }
  // Drop what the others imply, trying them in random order.
  const keep = chosen.map(() => true);
  for (const i of shuffle(rng, chosen.map((_, i) => i))) {
    keep[i] = false;
    if (!done(andAll(masks.filter((_, j) => keep[j]), words, total))) keep[i] = true;
  }
  // Strongest first: each condition rules out as much as it can.
  const ordered: Cond[] = [];
  const cur = andAll([], words, total);
  const rest = chosen.map((c, i) => ({ c, m: masks[i] })).filter((_, i) => keep[i]);
  while (rest.length) {
    let best = 0;
    let bestCount = Infinity;
    rest.forEach((r, i) => {
      let k = 0;
      for (let w = 0; w < words; w++) k += popcount(cur[w] & r.m[w]);
      if (k < bestCount) [best, bestCount] = [i, k];
    });
    for (let w = 0; w < words; w++) cur[w] &= rest[best].m[w];
    ordered.push(rest[best].c);
    rest.splice(best, 1);
  }
  return ordered;
}

function namesFor(rng: Rng, n: number) {
  return shuffle(rng, [...BOYS, ...GIRLS]).slice(0, n);
}

function hiddenFor(rng: Rng, n: number, valid: Int32Array): number[] {
  const perms = permsOf(n);
  const i = valid[randInt(rng, valid.length)];
  return Array.from(perms.subarray(i * n, i * n + n));
}

/** A puzzle with exactly one arrangement. `target`: about how many conditions (explore and show me). */
export function makeArrangement(kind: SeatKind, n: number, seed: number, target?: number): Arrangement {
  const size = SIZES[kind].includes(n) ? n : SIZES[kind][0];
  const rng = mulberry32(seed * 31 + size * 7 + kind.length * 101 + 5);
  const level = levelForSize(size);
  const lay = layoutOf(kind, size);
  const names = namesFor(rng, size);
  const attr = pick(rng, ["height", "age", "score"] as const);
  const fixed = kind === "round" ? randInt(rng, size) : null;
  const valid = validOf(kind, size, fixed);
  const cols = columnsOf(size, fixed, valid);
  const hidden = hiddenFor(rng, size, valid);
  let best: Cond[] | null = null;
  for (let attempt = 0; attempt < (target ? 16 : 10); attempt++) {
    const conds = buildConds(rng, lay, cols, hidden, level, one, () => false);
    const score = (c: Cond[]) => (target ? Math.abs(c.length - target) : Math.max(0, c.length - capOf(level)));
    if (!best || score(conds) < score(best)) best = conds;
    if (score(best) === 0) break;
  }
  return { kind, n: size, names, attr, fixed, conds: best!, solution: hidden };
}

// ─── Try-it questions ──────────────────────────────────────────────────────

export interface SeatQuestion extends Arrangement {
  type: SeatKind;
  level: Level;
  seed: number;
  /** place: build the whole arrangement; ask: name one person. */
  variant: "place" | "ask";
  ask: Ask | null;
  /** ask: the person asked for (-1 for place). */
  answer: number;
}

export function sizeFor(kind: SeatKind, level: Level, rng: Rng): number {
  if (kind === "rect") return level === 1 ? 4 : 6;
  return level === 1 ? 4 : level === 2 ? 5 + randInt(rng, 2) : 7;
}

function askFor(rng: Rng, lay: Layout, hidden: readonly number[]): Ask {
  const { kind, n } = lay;
  if (kind === "rank") return { rel: "at", p: randInt(rng, n) };
  const options: Ask[] = [];
  for (let of = 0; of < n; of++) {
    const s = hidden[of];
    if (isLinear(kind)) {
      if (s > 0) options.push({ rel: "prev", of });
      if (s < n - 1) options.push({ rel: "next", of });
    } else {
      if (lay.R[s] >= 0) options.push({ rel: "right", of });
      if (lay.L[s] >= 0) options.push({ rel: "left", of });
      // Across the table counts twice: it is the classic question.
      if (lay.O[s] >= 0) options.push({ rel: "opposite", of }, { rel: "opposite", of });
    }
  }
  if (isLinear(kind) && rng() < 0.4) return { rel: "at", p: randInt(rng, n) };
  return pick(rng, options);
}

function seatQuestion(kind: SeatKind, level: Level, seed: number, rng: Rng): SeatQuestion {
  const n = sizeFor(kind, level, rng);
  const lay = layoutOf(kind, n);
  const perms = permsOf(n);
  const names = namesFor(rng, n);
  const attr = pick(rng, ["height", "age", "score"] as const);
  const fixed = kind === "round" ? randInt(rng, n) : null;
  const valid = validOf(kind, n, fixed);
  const cols = columnsOf(n, fixed, valid);
  const hidden = hiddenFor(rng, n, valid);
  const variant = rng() < 0.5 ? "place" : "ask";
  const base = { kind, n, names, attr, fixed, solution: hidden, type: kind, level, seed, variant } as const;
  if (variant === "place") {
    let best: Cond[] | null = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const conds = buildConds(rng, lay, cols, hidden, level, one, () => false);
      if (!best || conds.length < best.length) best = conds;
      if (best.length <= capOf(level)) break;
    }
    return { ...base, conds: best!, ask: null, answer: -1 };
  }
  const ask = askFor(rng, lay, hidden);
  const target = askSeat(ask, hidden, 0, lay);
  const answer = hidden.indexOf(target);
  // The same person at the asked seat in every arrangement left.
  const done = (left: Uint32Array) => {
    for (const j of bitsOf(left)) {
      const off = valid[j] * n;
      const t = askSeat(ask, perms, off, lay);
      if (t < 0 || perms[off + answer] !== t) return false;
    }
    return true;
  };
  // No condition may give the answer away directly.
  const exclude = (c: Cond) => {
    const ps = condPeople(c);
    if (ask.rel === "at") return (c.k === "at" && (c.p === ask.p || c.a === answer)) || (ps.includes(answer) && c.k === "notEnd");
    return ps.includes(answer) && ps.includes(ask.of);
  };
  let best: Cond[] | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const conds = buildConds(rng, lay, cols, hidden, level, done, exclude);
    if (!best || conds.length < best.length) best = conds;
    if (best.length <= capOf(level)) break;
  }
  return { ...base, conds: best!, ask, answer };
}

// ─── Survivors (show me) ───────────────────────────────────────────────────

/** Arrangements (seat of each person) that satisfy the first k conditions. */
export function survivors(q: Arrangement, k: number): number[][] {
  const lay = layoutOf(q.kind, q.n);
  const perms = permsOf(q.n);
  const valid = validOf(q.kind, q.n, q.fixed);
  const conds = q.conds.slice(0, k);
  const out: number[][] = [];
  for (const i of valid) {
    const off = i * q.n;
    if (conds.every((c) => holds(c, perms, off, lay))) out.push(Array.from(perms.subarray(off, off + q.n)));
  }
  return out;
}

/** Arrangements a puzzle starts from (before any condition). */
export const totalOf = (q: Arrangement) => validOf(q.kind, q.n, q.fixed).length;

/** For each seat, the people who can still sit there. */
export function candidates(n: number, left: readonly (readonly number[])[]): Set<number>[] {
  const out = Array.from({ length: n }, () => new Set<number>());
  for (const s of left) s.forEach((seat, p) => out[seat].add(p));
  return out;
}

// ─── Family trees ──────────────────────────────────────────────────────────

/** Roles in the drawing: grandparents, father's sibling (s) and spouse (t), father, mother, mother's sibling (s2) and spouse (u), children. */
export type Role = "gf" | "gm" | "gf2" | "gm2" | "s" | "t" | "f" | "m" | "s2" | "u" | "k" | "c" | "k2";

export interface FPerson {
  name: string;
  male: boolean;
  gen: number;
  role: Role;
  /** Column in the drawing. */
  x: number;
  father: number;
  mother: number;
  spouse: number;
}

export type Fact = { k: "spouse"; a: number; b: number } | { k: "parent"; a: number; b: number } | { k: "child"; a: number; b: number } | { k: "sibling"; a: number; b: number };

export type FamilyAsk = { k: "rel"; x: number; y: number } | { k: "who"; word: string; y: number };

export type SeatTag = "right" | "flipped" | "sideFlip" | "opposite" | "apartCount" | "offByOne" | "frontBack" | "side" | "gender" | "generation" | "inverse" | "other";

export interface FamilyOption {
  text: string;
  /** "who" questions: the person. */
  person: number;
  tag: SeatTag;
}

export interface FamilyQuestion {
  type: "family";
  level: Level;
  seed: number;
  people: FPerson[];
  facts: Fact[];
  ask: FamilyAsk;
  options: FamilyOption[];
  /** Index of the right option. */
  answer: number;
}

export interface Tree {
  male: boolean[];
  father: number[];
  mother: number[];
  spouse: number[];
}

const parentsOf = (t: Tree, i: number) => [t.father[i], t.mother[i]].filter((p) => p >= 0);
const childrenOf = (t: Tree, i: number) => t.male.map((_, j) => j).filter((j) => t.father[j] === i || t.mother[j] === i);
export const areSiblings = (t: Tree, a: number, b: number) => a !== b && parentsOf(t, a).length > 0 && parentsOf(t, a).some((p) => parentsOf(t, b).includes(p));
const siblingsOf = (t: Tree, i: number) => t.male.map((_, j) => j).filter((j) => areSiblings(t, i, j));

/** How x is related to y, and through whom. */
export type RelPath =
  | { k: "spouse" | "parent" | "child" | "sibling" }
  | { k: "grandparent" | "grandchild" | "parentSibling" | "siblingChild" | "inLaw"; via: number }
  | { k: "auntUncleSpouse" | "cousin"; via: number; via2: number };

/** "x is y's ___": the Persian word, or null for relations the tool does not use. */
export function relation(t: Tree, x: number, y: number): { word: string; path: RelPath } | null {
  if (x === y) return null;
  const male = t.male[x];
  const side = (parent: number, sib: number) => (t.male[parent] ? (t.male[sib] ? "عمو" : "عمه") : t.male[sib] ? "دایی" : "خاله");
  if (t.spouse[x] === y) return { word: "همسر", path: { k: "spouse" } };
  if (parentsOf(t, y).includes(x)) return { word: male ? "پدر" : "مادر", path: { k: "parent" } };
  if (parentsOf(t, x).includes(y)) return { word: male ? "پسر" : "دختر", path: { k: "child" } };
  if (areSiblings(t, x, y)) return { word: male ? "برادر" : "خواهر", path: { k: "sibling" } };
  for (const p of parentsOf(t, y)) if (parentsOf(t, p).includes(x)) return { word: male ? "پدربزرگ" : "مادربزرگ", path: { k: "grandparent", via: p } };
  for (const p of parentsOf(t, x)) if (parentsOf(t, p).includes(y)) return { word: "نوه", path: { k: "grandchild", via: p } };
  for (const p of parentsOf(t, y)) if (areSiblings(t, x, p)) return { word: side(p, x), path: { k: "parentSibling", via: p } };
  for (const p of parentsOf(t, y))
    for (const s of siblingsOf(t, p))
      if (t.spouse[s] === x) {
        const w = side(p, s);
        return { word: w === "عمو" ? "زن‌عمو" : w === "عمه" ? "شوهرعمه" : w === "دایی" ? "زن‌دایی" : "شوهرخاله", path: { k: "auntUncleSpouse", via: p, via2: s } };
      }
  for (const p of parentsOf(t, x)) if (areSiblings(t, y, p)) return { word: t.male[p] ? "برادرزاده" : "خواهرزاده", path: { k: "siblingChild", via: p } };
  for (const p of parentsOf(t, x))
    for (const q of parentsOf(t, y)) if (areSiblings(t, p, q)) return { word: (male ? "پسر" : "دختر") + side(q, p), path: { k: "cousin", via: p, via2: q } };
  for (const c of childrenOf(t, y)) if (t.spouse[c] === x) return { word: male ? "داماد" : "عروس", path: { k: "inLaw", via: c } };
  return null;
}

export const treeOf = (people: readonly FPerson[]): Tree => ({
  male: people.map((p) => p.male),
  father: people.map((p) => p.father),
  mother: people.map((p) => p.mother),
  spouse: people.map((p) => p.spouse),
});

/** The tree the sentences describe, worked out from them alone (genders from the names). */
export function rebuild(male: readonly boolean[], facts: readonly Fact[]): Tree {
  const n = male.length;
  const spouse = Array(n).fill(-1);
  const parents = Array.from({ length: n }, () => new Set<number>());
  const sib = Array.from({ length: n }, (_, i) => i);
  const root = (i: number): number => (sib[i] === i ? i : (sib[i] = root(sib[i])));
  for (const f of facts) {
    if (f.k === "spouse") [spouse[f.a], spouse[f.b]] = [f.b, f.a];
    else if (f.k === "parent") parents[f.b].add(f.a);
    else if (f.k === "child") parents[f.a].add(f.b);
    else sib[root(f.a)] = root(f.b);
  }
  // A child of a married person is the child of the couple; siblings share parents.
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < n; i++) {
      const before = parents[i].size;
      for (const p of [...parents[i]]) if (spouse[p] >= 0) parents[i].add(spouse[p]);
      for (let j = 0; j < n; j++) if (j !== i && root(j) === root(i)) for (const p of parents[j]) parents[i].add(p);
      if (parents[i].size !== before) changed = true;
    }
  }
  return {
    male: [...male],
    father: parents.map((ps) => [...ps].find((p) => male[p]) ?? -1),
    mother: parents.map((ps) => [...ps].find((p) => !male[p]) ?? -1),
    spouse,
  };
}

const LEVEL_WORDS: Record<Level, string[]> = {
  1: ["همسر", "پدر", "مادر", "پسر", "دختر", "برادر", "خواهر"],
  2: ["پدر", "مادر", "پسر", "دختر", "برادر", "خواهر", "پدربزرگ", "مادربزرگ", "نوه", "عمو", "عمه", "زن‌عمو", "شوهرعمه", "برادرزاده", "خواهرزاده", "پسرعمو", "دخترعمو", "پسرعمه", "دخترعمه", "عروس", "داماد"],
  3: [
    "پدر", "مادر", "پسر", "دختر", "برادر", "خواهر", "پدربزرگ", "مادربزرگ", "نوه", "عمو", "عمه", "دایی", "خاله", "زن‌عمو", "شوهرعمه", "زن‌دایی", "شوهرخاله",
    "برادرزاده", "خواهرزاده", "پسرعمو", "دخترعمو", "پسرعمه", "دخترعمه", "پسردایی", "دختردایی", "پسرخاله", "دخترخاله", "عروس", "داماد",
  ],
};

const SIDE_SWAP: Record<string, string> = {
  عمو: "دایی", دایی: "عمو", عمه: "خاله", خاله: "عمه", "زن‌عمو": "زن‌دایی", "زن‌دایی": "زن‌عمو", شوهرعمه: "شوهرخاله", شوهرخاله: "شوهرعمه",
  پسرعمو: "پسردایی", پسردایی: "پسرعمو", دخترعمو: "دختردایی", دختردایی: "دخترعمو", پسرعمه: "پسرخاله", پسرخاله: "پسرعمه", دخترعمه: "دخترخاله", دخترخاله: "دخترعمه",
  برادرزاده: "خواهرزاده", خواهرزاده: "برادرزاده",
};
const GENDER_SWAP: Record<string, string> = {
  پدر: "مادر", مادر: "پدر", پسر: "دختر", دختر: "پسر", برادر: "خواهر", خواهر: "برادر", پدربزرگ: "مادربزرگ", مادربزرگ: "پدربزرگ",
  عمو: "عمه", عمه: "عمو", دایی: "خاله", خاله: "دایی", عروس: "داماد", داماد: "عروس",
  پسرعمو: "دخترعمو", دخترعمو: "پسرعمو", پسرعمه: "دخترعمه", دخترعمه: "پسرعمه", پسردایی: "دختردایی", دختردایی: "پسردایی", پسرخاله: "دخترخاله", دخترخاله: "پسرخاله",
};
const GENERATION_SWAP: Record<string, string> = {
  پدر: "پدربزرگ", مادر: "مادربزرگ", پدربزرگ: "پدر", مادربزرگ: "مادر", پسر: "نوه", دختر: "نوه", نوه: "پسر", برادر: "پسرعمو", خواهر: "دخترعمو",
  عمو: "پسرعمو", عمه: "دخترعمه", دایی: "پسردایی", خاله: "دخترخاله", پسرعمو: "عمو", دخترعمو: "عمه", پسرعمه: "عمه", دخترعمه: "عمه", پسردایی: "دایی", دختردایی: "خاله", پسرخاله: "خاله", دخترخاله: "خاله",
  برادرزاده: "برادر", خواهرزاده: "خواهر", "زن‌عمو": "مادربزرگ", "زن‌دایی": "مادربزرگ", شوهرعمه: "پدربزرگ", شوهرخاله: "پدربزرگ", عروس: "دختر", داماد: "پسر",
};

/** Words a slip would give instead of `word`, with the slip; `inverse` is y's relation to x. */
export function wordSlips(word: string, inverse: string | null): [SeatTag, string][] {
  const out: [SeatTag, string][] = [];
  if (SIDE_SWAP[word]) out.push(["side", SIDE_SWAP[word]]);
  if (inverse && inverse !== word) out.push(["inverse", inverse]);
  if (GENERATION_SWAP[word]) out.push(["generation", GENERATION_SWAP[word]]);
  if (GENDER_SWAP[word]) out.push(["gender", GENDER_SWAP[word]]);
  return out;
}

/** Persian ezafe: "عمو" → "عموی", "خاله" → "خاله‌ی". */
export function ezafe(word: string) {
  if (word.endsWith("ه")) return `${word}‌ی`;
  if (word.endsWith("و") || word.endsWith("ا")) return `${word}ی`;
  return word;
}

function familyPeople(rng: Rng, level: Level): FPerson[] {
  const boys = shuffle(rng, BOYS);
  const girls = shuffle(rng, GIRLS);
  const people: FPerson[] = [];
  const add = (role: Role, male: boolean, gen: number, x: number) => {
    people.push({ name: (male ? boys : girls).pop()!, male, gen, role, x, father: -1, mother: -1, spouse: -1 });
    return people.length - 1;
  };
  const marry = (a: number, b: number) => ([people[a].spouse, people[b].spouse] = [b, a]);
  const child = (c: number, f: number, m: number) => ([people[c].father, people[c].mother] = [f, m]);
  const kids = (count: number, f: number, m: number, gen: number, role: Role, x0: number, step = 1) =>
    Array.from({ length: count }, (_, i) => {
      const c = add(role, rng() < 0.5, gen, x0 + i * step);
      child(c, f, m);
      return c;
    });

  if (level === 1) {
    const f = add("f", true, 0, 1);
    const m = add("m", false, 0, 2);
    marry(f, m);
    const n = 2 + randInt(rng, 2);
    kids(n, f, m, 1, "c", 1.5 - (n - 1) / 2);
    return people;
  }
  // Paternal side: grandparents, father and his sibling (perhaps married, with a child).
  // Columns: t 0, s 1, f 2, m 3, s2 4, u 5; each couple's children under it.
  const L3 = level === 3;
  const gf = add("gf", true, 0, L3 ? 0.7 : 1);
  const gm = add("gm", false, 0, L3 ? 1.7 : 2);
  marry(gf, gm);
  const sMale = rng() < 0.5;
  const s = add("s", sMale, 1, 1);
  const f = add("f", true, 1, 2);
  const m = add("m", false, 1, 3);
  child(s, gf, gm);
  child(f, gf, gm);
  marry(f, m);
  if (rng() < 0.6) {
    const t = add("t", !sMale, 1, 0);
    marry(s, t);
    kids(1, sMale ? s : t, sMale ? t : s, 2, "k", 0.5);
  }
  const nc = level === 2 ? 2 : 1 + randInt(rng, 2);
  kids(nc, f, m, 2, "c", nc === 1 ? 2.5 : 2);
  if (!L3) return people;
  // Maternal side.
  const gf2 = add("gf2", true, 0, 3.3);
  const gm2 = add("gm2", false, 0, 4.3);
  marry(gf2, gm2);
  child(m, gf2, gm2);
  const s2Male = rng() < 0.5;
  const s2 = add("s2", s2Male, 1, 4);
  child(s2, gf2, gm2);
  if (rng() < 0.6) {
    const u = add("u", !s2Male, 1, 5);
    marry(s2, u);
    kids(1, s2Male ? s2 : u, s2Male ? u : s2, 2, "k2", 4.5);
  }
  return people;
}

/** Sentences that pin the tree down: every couple, and each child tied to a parent or a sibling. */
function familyFacts(rng: Rng, people: FPerson[]): Fact[] {
  const facts: Fact[] = [];
  people.forEach((p, i) => {
    if (p.spouse > i) facts.push({ k: "spouse", a: i, b: p.spouse });
  });
  const groups = new Map<number, number[]>();
  people.forEach((p, i) => {
    if (p.father >= 0) groups.set(p.father, [...(groups.get(p.father) ?? []), i]);
  });
  for (const [f, kids] of groups) {
    const m = people[kids[0]].mother;
    shuffle(rng, kids).forEach((c, j, all) => {
      if (j > 0 && rng() < 0.5) facts.push({ k: "sibling", a: c, b: all[randInt(rng, j)] });
      else {
        const parent = rng() < 0.5 ? f : m;
        facts.push(rng() < 0.5 ? { k: "parent", a: parent, b: c } : { k: "child", a: c, b: parent });
      }
    });
  }
  // A connected order: each sentence after the first names someone already met.
  const out: Fact[] = [];
  const met = new Set<number>();
  let rest = shuffle(rng, facts);
  while (rest.length) {
    const i = Math.max(0, rest.findIndex((f) => met.has(f.a) || met.has(f.b)));
    const f = rest[i];
    out.push(f);
    met.add(f.a);
    met.add(f.b);
    rest = rest.filter((_, j) => j !== i);
  }
  return out;
}

const factPair = (f: Fact) => [f.a, f.b];
const WEIGHT: Record<Level, (w: string) => number> = {
  1: () => 1,
  2: (w) => (["پدر", "مادر", "پسر", "دختر", "برادر", "خواهر"].includes(w) ? 0.4 : 3),
  3: (w) => (/دایی|خاله/.test(w) ? 5 : /پسر.|دختر./.test(w) ? 3 : ["پدر", "مادر", "پسر", "دختر", "برادر", "خواهر"].includes(w) ? 0.2 : 1),
};

function weighted<T>(rng: Rng, items: { v: T; w: number }[]): T {
  const total = items.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  for (const x of items) if ((r -= x.w) < 0) return x.v;
  return items[items.length - 1].v;
}

function familyQuestion(level: Level, seed: number, rng: Rng): FamilyQuestion {
  const people = familyPeople(rng, level);
  const facts = familyFacts(rng, people);
  const t = treeOf(people);
  const n = people.length;
  const told = new Set(facts.map((f) => factPair(f).sort((a, b) => a - b).join()));
  // word[x][y]: x is y's ___.
  const word = people.map((_, x) => people.map((_, y) => relation(t, x, y)?.word ?? null));
  const pairs: { v: [number, number, string]; w: number }[] = [];
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++) {
      const r = word[x][y] === null ? null : { word: word[x][y]! };
      if (!r || !LEVEL_WORDS[level].includes(r.word) || told.has([x, y].sort((a, b) => a - b).join())) continue;
      pairs.push({ v: [x, y, r.word], w: WEIGHT[level](r.word) });
    }
  // "Who is y's ___?" needs exactly one such person.
  const holders = (y: number, w: string) => people.filter((_, z) => word[z][y] === w).length;
  const unique = pairs.filter(({ v: [, y, w] }) => holders(y, w) === 1);
  // Four names to choose from need five people.
  const who = unique.length > 0 && n >= 5 && rng() < 0.4;
  const [x, y, asked] = weighted(rng, who ? unique : pairs);
  let options: FamilyOption[];
  if (!who) {
    const inverse = word[y][x];
    const slips = wordSlips(asked, inverse).filter(([, w]) => w !== asked);
    options = [{ text: asked, person: -1, tag: "right" }];
    for (const [tag, w] of slips) if (options.length < 4 && !options.some((o) => o.text === w)) options.push({ text: w, person: -1, tag });
    for (const w of shuffle(rng, LEVEL_WORDS[level])) if (options.length < 4 && !options.some((o) => o.text === w)) options.push({ text: w, person: -1, tag: "other" });
  } else {
    options = [{ text: people[x].name, person: x, tag: "right" }];
    const slipWords = wordSlips(asked, null);
    for (let z = 0; z < n; z++) {
      if (z === x || z === y || options.length >= 4) continue;
      const r = word[z][y];
      const s = slipWords.find(([, w]) => w === r);
      if (s) options.push({ text: people[z].name, person: z, tag: s[0] });
      else if (word[y][z] === asked) options.push({ text: people[z].name, person: z, tag: "inverse" });
    }
    for (const z of shuffle(rng, people.map((_, i) => i))) if (options.length < 4 && z !== y && !options.some((o) => o.person === z)) options.push({ text: people[z].name, person: z, tag: "other" });
  }
  options = shuffle(rng, options);
  return {
    type: "family",
    level,
    seed,
    people,
    facts,
    ask: who ? { k: "who", word: asked, y } : { k: "rel", x, y },
    options,
    answer: options.findIndex((o) => o.tag === "right"),
  };
}

// ─── Entry point and slips ─────────────────────────────────────────────────

export type SeatingQuestion = SeatQuestion | FamilyQuestion;

export function makeSeatingQuestion(type: SeatingType, level: Level, seed: number): SeatingQuestion {
  const rng = mulberry32(seed * 13 + level * 977 + type.length * 59 + type.charCodeAt(1));
  if (type === "family") return familyQuestion(level, seed, rng);
  return seatQuestion(type, level, seed, rng);
}

/** For a family "who" question, the person. */
export const familyAnswerPerson = (q: FamilyQuestion) => (q.ask.k === "who" ? q.options[q.answer].person : q.ask.x);

/** Wrong people with a known cause for an "ask" question, from the hidden arrangement. */
export function askSlips(q: SeatQuestion): [SeatTag, number][] {
  if (!q.ask) return [];
  const lay = layoutOf(q.kind, q.n);
  const s = q.solution;
  const at = (seat: number) => (seat >= 0 && seat < q.n ? s.indexOf(seat) : -1);
  const ask = q.ask;
  const out: [SeatTag, number][] = [];
  if (ask.rel === "at") {
    out.push(["flipped", at(q.n - 1 - ask.p)], ["offByOne", at(ask.p - 1)], ["offByOne", at(ask.p + 1)]);
  } else {
    const so = s[ask.of];
    if (ask.rel === "prev") out.push(["flipped", at(so + 1)]);
    if (ask.rel === "next") out.push(["flipped", at(so - 1)]);
    if (ask.rel === "right") out.push(["flipped", at(lay.L[so])], ["offByOne", lay.R[so] >= 0 ? at(lay.R[lay.R[so]]) : -1]);
    if (ask.rel === "left") out.push(["flipped", at(lay.R[so])], ["offByOne", lay.L[so] >= 0 ? at(lay.L[lay.L[so]]) : -1]);
    if (ask.rel === "opposite") {
      const o = lay.O[so];
      out.push(["opposite", at(lay.R[o])], ["opposite", at(lay.L[o])]);
    }
  }
  return out.filter(([, p]) => p >= 0 && p !== q.answer && p !== (ask.rel === "at" ? -2 : ask.of));
}

export function askMistake(q: SeatQuestion, person: number): SeatTag {
  if (person === q.answer) return "right";
  return askSlips(q).find(([, p]) => p === person)?.[0] ?? "other";
}

/** A whole arrangement checked: the slip, and which conditions it breaks. */
export function placeMistake(q: Arrangement, seatOf: readonly number[]): { tag: SeatTag; bad: number[] } {
  const lay = layoutOf(q.kind, q.n);
  const bad = q.conds.map((c, i) => (holds(c, seatOf, 0, lay) ? -1 : i)).filter((i) => i >= 0);
  // Exactly one arrangement keeps every condition.
  if (!bad.length) return { tag: "right", bad };
  if (q.solution.every((seat, p) => lay.mirror[seat] === seatOf[p])) return { tag: "flipped", bad };
  const sides = bad.filter((i) => ["right", "left", "right2"].includes(q.conds[i].k));
  const mirrored = (c: Cond) => {
    const { a, b } = c as { a: number; b: number };
    const [sa, sb] = [seatOf[a], seatOf[b]];
    if (c.k === "right") return sa === lay.L[sb];
    if (c.k === "left") return sa === lay.R[sb];
    return lay.L[sb] >= 0 && sa === lay.L[lay.L[sb]];
  };
  if (sides.length && sides.some((i) => mirrored(q.conds[i]))) return { tag: "sideFlip", bad };
  for (const i of bad) {
    const c = q.conds[i];
    if (c.k === "opposite") {
      const o = lay.O[seatOf[c.b]];
      if (lay.R[o] === seatOf[c.a] || lay.L[o] === seatOf[c.a]) return { tag: "opposite", bad };
    }
    if (c.k === "apart" && Math.abs(Math.abs(seatOf[c.a] - seatOf[c.b]) - c.d) === 1) return { tag: "apartCount", bad };
    if (c.k === "justAhead" && seatOf[c.a] === seatOf[c.b] + 1) return { tag: "frontBack", bad };
    if (c.k === "at" && seatOf[c.a] === q.n - 1 - c.p) return { tag: "flipped", bad };
  }
  return { tag: "other", bad };
}
