// Tool 12: balance scale. Symbols (circle, triangle, square) stand for unknown
// whole-number weights; numbered blocks are known weights. A pan is a count
// of each symbol plus one known weight. Questions keep their answer and the
// usual slips, so the feedback can say which slip a wrong answer was.
//
// The step solver below solves a system the way a child would: take the same
// thing off both pans, split a pan into equal parts, and substitute what one
// scale says into another. "Show me" plays its stages.

import { mulberry32, pick, randInt, shuffle, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type BalanceQuestionType = "balance" | "fill" | "coin" | "age";

/** Symbols differ by shape first; colour only helps. */
export const SYMBOLS = [
  { name: "دایره", glyph: "●" },
  { name: "مثلث", glyph: "▲" },
  { name: "مربع", glyph: "■" },
] as const;

/** Known weights a child can put on a pan. */
export const BLOCKS = [1, 2, 5, 10] as const;

export interface Pan {
  /** How many of each symbol. */
  s: number[];
  /** Known weight on the pan (drawn as one numbered block). */
  k: number;
}

export interface Scale {
  left: Pan;
  right: Pan;
}

export const emptyPan = (n: number): Pan => ({ s: Array<number>(n).fill(0), k: 0 });
export const panWeight = (p: Pan, w: readonly number[]) => p.s.reduce((t, c, i) => t + c * w[i], p.k);
export const isBalanced = (sc: Scale, w: readonly number[]) => panWeight(sc.left, w) === panWeight(sc.right, w);
export const symCount = (p: Pan) => p.s.reduce((a, b) => a + b, 0);
const clonePan = (p: Pan): Pan => ({ s: [...p.s], k: p.k });
export const cloneScales = (ss: Scale[]): Scale[] => ss.map((sc) => ({ left: clonePan(sc.left), right: clonePan(sc.right) }));
const has = (sc: Scale, j: number) => sc.left.s[j] + sc.right.s[j] > 0;

/** Every weight vector in 1 … max that balances every scale (for tests and checks). */
export function solutions(scales: Scale[], n: number, max: number): number[][] {
  const out: number[][] = [];
  const w = Array<number>(n).fill(1);
  // Each scale as coefficients (left minus right) and a constant: balanced when the sum is 0.
  const rows = scales.map((sc) => ({ c: sc.left.s.map((v, i) => v - sc.right.s[i]), k: sc.left.k - sc.right.k }));
  const rec = (i: number) => {
    if (i === n) {
      if (rows.every((r) => r.c.reduce((t, c, j) => t + c * w[j], r.k) === 0)) out.push([...w]);
      return;
    }
    for (let v = 1; v <= max; v++) {
      w[i] = v;
      rec(i + 1);
    }
  };
  rec(0);
  return out;
}

/** Determinant of the symbol coefficients (left minus right) of n scales in n unknowns. */
export function determinant(scales: Scale[], n: number): number {
  const m = scales.slice(0, n).map((sc) => sc.left.s.map((c, i) => c - sc.right.s[i]));
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

// ── Questions ───────────────────────────────────────────────────────────

interface Base {
  level: Level;
  seed: number;
}

/** Scales with symbols; what does one symbol weigh? */
export interface BalanceQuestion extends Base {
  type: "balance";
  n: number;
  scales: Scale[];
  weights: number[];
  ask: number;
  answer: number;
}

/**
 * The scales are given; one more scale has `target` on one pan and nothing on
 * the other. Fill the empty pan with numbered blocks (answer = total weight,
 * any mix of blocks with that total is right) or with one symbol (answer = how many).
 */
export interface FillQuestion extends Base {
  type: "fill";
  n: number;
  scales: Scale[];
  weights: number[];
  target: Pan;
  /** null: numbered blocks; otherwise the symbol to fill with. */
  fillWith: number | null;
  answer: number;
}

/**
 * Exactly one coin is fake and we know whether it is lighter or heavier; a
 * two-pan balance with no weights. min: n coins, fewest weighings that always
 * find it. max: k weighings, the most coins it can always be found among.
 */
export interface CoinQuestion extends Base {
  type: "coin";
  variant: "min" | "max";
  n: number;
  heavy: boolean;
  k: number;
  /** The fake, for the demonstration. */
  fake: number;
  answer: number;
}

/**
 * sumDiff: sum and difference. timesSum / timesDiff: one is `times` times the
 * other, and the sum or the difference. later: `times` now, `laterTimes` in
 * `years` years. Ages are now.
 */
export interface AgeQuestion extends Base {
  type: "age";
  variant: "sumDiff" | "timesSum" | "timesDiff" | "later";
  older: string;
  younger: string;
  young: number;
  old: number;
  times: number;
  laterTimes: number;
  years: number;
  askOlder: boolean;
  answer: number;
}

export type BalanceQ = BalanceQuestion | FillQuestion | CoinQuestion | AgeQuestion;

/** What kind of answer a question wants: a number, or blocks on the empty pan. */
export const answerKind = (type: BalanceQuestionType): "number" | "pan" => (type === "fill" ? "pan" : "number");

const MAX_W = 15; // a symbol weighs at most this
const MAX_K = 40; // one block
const MAX_SYMS = 6; // symbols on one pan

const fits = (sc: Scale) =>
  [sc.left, sc.right].every((p) => symCount(p) <= MAX_SYMS && p.k <= MAX_K && (symCount(p) > 0 || p.k > 0)) &&
  (sc.left.k !== sc.right.k || sc.left.s.some((c, i) => c !== sc.right.s[i]));

/** Make the known weights balance: put the difference on the lighter pan. */
function settle(sc: Scale, w: number[]): Scale {
  const d = panWeight(sc.left, w) - panWeight(sc.right, w);
  if (d > 0) sc.right.k += d;
  else sc.left.k -= d;
  return sc;
}

/** Sometimes the same thing on both pans, to take off again. */
function addCommon(rng: Rng, sc: Scale, chance: number) {
  if (rng() >= chance) return;
  const present = sc.left.s.map((_, i) => i).filter((i) => has(sc, i));
  if (rng() < 0.5 && present.length) {
    const j = pick(rng, present);
    sc.left.s[j]++;
    sc.right.s[j]++;
  } else {
    const e = 1 + randInt(rng, 5);
    sc.left.k += e;
    sc.right.k += e;
  }
}

const swapMaybe = (rng: Rng, sc: Scale): Scale => (rng() < 0.5 ? { left: sc.right, right: sc.left } : sc);

/** a·s + b = c·s + d for symbol i. */
function oneUnknown(rng: Rng, n: number, i: number, w: number[], strict: boolean): Scale {
  for (;;) {
    const a = 2 + randInt(rng, 3);
    const c = randInt(rng, Math.min(a, 3));
    const b = rng() < 0.5 ? 0 : 1 + randInt(rng, 6);
    // Level 1 always has something to take off both pans.
    if (strict && c === 0 && b === 0) continue;
    const left = emptyPan(n);
    const right = emptyPan(n);
    left.s[i] = a;
    left.k = b;
    right.s[i] = c;
    right.k = (a - c) * w[i] + b;
    return { left, right };
  }
}

/** Counts of the symbols below i: each 0 … max, not all zero. */
function lowerMix(rng: Rng, n: number, i: number, max: number): number[] {
  for (;;) {
    const s = Array<number>(n).fill(0);
    for (let j = 0; j < i; j++) s[j] = randInt(rng, max + 1);
    if (s.some((c) => c > 0)) return s;
  }
}

/** A numeric system of n scales in n unknowns that substitution solves. */
function numericSystem(rng: Rng, n: number, strict: boolean): { scales: Scale[]; weights: number[] } {
  for (;;) {
    let scales: Scale[] = [];
    const w = Array<number>(n).fill(0);
    if (n === 1 || rng() < 0.5) {
      // Base: the circle alone first, then each symbol with the ones before it.
      w[0] = 2 + randInt(rng, n === 1 ? 8 : 5);
      scales.push(oneUnknown(rng, n, 0, w, strict));
      for (let i = 1; i < n; i++) {
        w[i] = 2 + randInt(rng, 10);
        const left = emptyPan(n);
        const right = emptyPan(n);
        left.s[i] = rng() < 0.75 ? 1 : 2;
        const mix = lowerMix(rng, n, i, 2);
        // The lower symbols go on either pan.
        mix.forEach((c, j) => (rng() < 0.5 ? (left.s[j] += c) : (right.s[j] += c)));
        scales.push(settle({ left, right }, w));
      }
    } else {
      // Chain: each symbol defined by the ones before it, and one scale with a total.
      w[0] = 1 + randInt(rng, 5);
      for (let i = 1; i < n; i++) {
        const left = emptyPan(n);
        const right = emptyPan(n);
        left.s[i] = 1;
        right.s = lowerMix(rng, n, i, 3);
        right.k = rng() < 0.5 ? 0 : 1 + randInt(rng, 4);
        w[i] = panWeight(right, w);
        scales.push({ left, right });
      }
      const left = emptyPan(n);
      const right = emptyPan(n);
      for (let j = 0; j < n; j++) left.s[j] = randInt(rng, 3);
      left.s[n - 1] = Math.max(1, left.s[n - 1]);
      if (rng() < 0.4) right.s[0] = 1;
      scales.push(settle({ left, right }, w));
    }
    if (w.some((v) => v < 1 || v > MAX_W) || new Set(w).size < n) continue;
    if (determinant(scales, n) === 0) continue;
    for (const sc of scales) addCommon(rng, sc, n === 1 ? 0 : 0.3);
    if (!scales.every(fits)) continue;
    scales = shuffle(rng, scales).map((sc) => swapMaybe(rng, sc));
    return { scales, weights: w };
  }
}

/** Relations with no numbers: n symbols, n − 1 scales; circle = 1 in the smallest solution. */
function symbolicSystem(rng: Rng, n: number): { scales: Scale[]; weights: number[] } {
  for (;;) {
    const p = 2 + randInt(rng, n === 2 ? 3 : 2);
    const w = [1, p];
    const tri = { left: emptyPan(n), right: emptyPan(n) };
    const form = randInt(rng, 3);
    if (form === 1 && p + 1 <= MAX_SYMS) {
      tri.left.s[1] = 1;
      tri.left.s[0] = 1;
      tri.right.s[0] = p + 1;
    } else if (form === 2 && 2 * p <= MAX_SYMS) {
      tri.left.s[1] = 2;
      tri.right.s[0] = 2 * p;
    } else {
      tri.left.s[1] = 1;
      tri.right.s[0] = p;
    }
    const scales = [tri];
    if (n === 3) {
      const sq = { left: emptyPan(n), right: emptyPan(n) };
      const kind = randInt(rng, 3);
      sq.left.s[2] = 1;
      if (kind === 0) {
        const q = 2 + randInt(rng, 2);
        sq.right.s[1] = q;
        w.push(q * p);
      } else if (kind === 1) {
        const r = 1 + randInt(rng, 3);
        sq.right.s[1] = 1;
        sq.right.s[0] = r;
        w.push(p + r);
      } else {
        // ■ + ● = ▲▲
        sq.left.s[0] = 1;
        sq.right.s[1] = 2;
        w.push(2 * p - 1);
      }
      if (new Set(w).size < 3) continue;
      scales.push(sq);
    }
    return { scales: shuffle(rng, scales).map((sc) => swapMaybe(rng, sc)), weights: w };
  }
}

function balanceQuestion(rng: Rng, level: Level, seed: number): BalanceQuestion {
  for (;;) {
    const n = level;
    const { scales, weights } = numericSystem(rng, n, level === 1);
    const ask = n === 1 ? 0 : randInt(rng, n);
    const q: BalanceQuestion = { type: "balance", level, seed, n, scales, weights, ask, answer: weights[ask] };
    if (solved(q)) return q;
  }
}

function fillQuestion(rng: Rng, level: Level, seed: number): FillQuestion {
  for (;;) {
    const n = level;
    const symbolic = level > 1 && rng() < 0.5;
    const { scales, weights } = symbolic ? symbolicSystem(rng, n) : numericSystem(rng, n, false);
    const target = emptyPan(n);
    for (let j = 0; j < n; j++) target.s[j] = randInt(rng, 3);
    if (symbolic) {
      // Something bigger than a circle must be on it.
      target.s[n - 1] = Math.max(1, target.s[n - 1]);
    } else if (rng() < 0.4) target.k = 1 + randInt(rng, 6);
    const kinds = target.s.filter((c) => c > 0).length;
    if (symCount(target) === 0 || symCount(target) > 5 || (n > 1 && kinds < Math.min(2, n))) continue;
    const answer = panWeight(target, weights) / (symbolic ? weights[0] : 1);
    if (answer < 4 || answer > (symbolic ? 14 : MAX_K)) continue;
    const q: FillQuestion = { type: "fill", level, seed, n, scales, weights, target, fillWith: symbolic ? 0 : null, answer };
    if (solved(q)) return q;
  }
}

/** Fewest weighings that always find a fake known to be lighter (or heavier) among n: ⌈log₃ n⌉. */
export function minWeighings(n: number) {
  let k = 0;
  for (let p = 1; p < n; p *= 3) k++;
  return k;
}

function coinQuestion(rng: Rng, level: Level, seed: number): CoinQuestion {
  const heavy = level > 1 && rng() < 0.5;
  if (level === 3 && rng() < 0.4) {
    const k = 2 + randInt(rng, 3);
    const n = 3 ** k;
    return { type: "coin", level, seed, variant: "max", n, heavy, k, fake: randInt(rng, n), answer: n };
  }
  const n = level === 1 ? 3 + randInt(rng, 7) : level === 2 ? 7 + randInt(rng, 24) : 28 + randInt(rng, 93);
  const k = minWeighings(n);
  return { type: "coin", level, seed, variant: "min", n, heavy, k, fake: randInt(rng, n), answer: k };
}

const SIBLINGS: [string, string][] = [
  ["سارا", "علی"],
  ["مریم", "رضا"],
  ["نازنین", "نیما"],
  ["امیر", "زهرا"],
  ["پارسا", "یاسمن"],
];
const FAMILY: [string, string][] = [
  ["پدر علی", "علی"],
  ["مادر سارا", "سارا"],
  ["پدربزرگ نیما", "نیما"],
  ["خاله مریم", "مریم"],
  ["عموی رضا", "رضا"],
];

function ageQuestion(rng: Rng, level: Level, seed: number): AgeQuestion {
  const base = { type: "age" as const, level, seed, times: 1, laterTimes: 1, years: 0 };
  if (level === 1) {
    const [a, b] = pick(rng, SIBLINGS);
    const young = 5 + randInt(rng, 15);
    const d = 2 + randInt(rng, 8);
    const askOlder = rng() < 0.5;
    const old = young + d;
    return { ...base, variant: "sumDiff", older: a, younger: b, young, old, askOlder, answer: askOlder ? old : young };
  }
  const [older, younger] = pick(rng, FAMILY);
  if (level === 2) {
    for (;;) {
      const young = 3 + randInt(rng, 12);
      const times = 2 + randInt(rng, 4);
      const old = times * young;
      if (old < 21 || old > 64) continue;
      const askOlder = rng() < 0.3;
      return { ...base, variant: rng() < 0.5 ? "timesSum" : "timesDiff", older, younger, young, old, times, askOlder, answer: askOlder ? old : young };
    }
  }
  for (;;) {
    const young = 3 + randInt(rng, 12);
    const times = 3 + randInt(rng, 4);
    const laterTimes = 2 + randInt(rng, times - 2);
    const years = (young * (times - laterTimes)) / (laterTimes - 1);
    const old = times * young;
    if (!Number.isInteger(years) || years < 2 || years > 24 || old < 21 || old > 75) continue;
    const askOlder = rng() < 0.3;
    return { ...base, variant: "later", older, younger, young, old, times, laterTimes, years, askOlder, answer: askOlder ? old : young };
  }
}

export function makeBalanceQuestion(type: BalanceQuestionType, level: Level, seed: number): BalanceQ {
  const rng = mulberry32(seed * 11 + level * 131 + type.length * 17);
  switch (type) {
    case "balance":
      return balanceQuestion(rng, level, seed);
    case "fill":
      return fillQuestion(rng, level, seed);
    case "coin":
      return coinQuestion(rng, level, seed);
    case "age":
      return ageQuestion(rng, level, seed);
  }
}

// ── The step solver ─────────────────────────────────────────────────────

export type Step =
  /** Take `removed` off both pans of scale `focus`. */
  | { op: "remove"; focus: number; removed: Pan }
  /** Scale `focus` is `times` × symbol against things that split into `times` equal parts. */
  | { op: "divide"; focus: number; sym: number; times: number; symLeft: boolean }
  /** Put a block of `value` in place of every `sym` on the `targets` scales. */
  | { op: "value"; sym: number; value: number; targets: number[] }
  /** Scale `from` says sym = expr; put expr in place of every sym on scale `focus`. */
  | { op: "define"; sym: number; from: number; focus: number; expr: Pan };

export interface Stage {
  step: Step;
  before: Scale[];
  after: Scale[];
}

/** One side is `times` copies of one symbol and nothing else. */
function lone(p: Pan): { sym: number; times: number } | null {
  if (p.k !== 0) return null;
  const used = p.s.map((c, i) => [c, i]).filter(([c]) => c > 0);
  return used.length === 1 ? { sym: used[0][1], times: used[0][0] } : null;
}

/**
 * Solves as a child would, one stage at a time, until `done` says stop. The
 * scale `open` (if any) is the one with the empty pan: it is only substituted
 * into, never solved. `keep` is a symbol not to replace by a number or by
 * other symbols in the open scale (filling with circles).
 */
export function solveSteps(start: Scale[], n: number, done: (scales: Scale[], known: (number | null)[]) => boolean, open = -1, keep = -1) {
  let scales = cloneScales(start);
  const known: (number | null)[] = Array(n).fill(null);
  const finished = scales.map(() => false);
  const stages: Stage[] = [];
  const push = (step: Step, next: Scale[]) => {
    stages.push({ step, before: scales, after: next });
    scales = next;
  };

  outer: while (!done(scales, known) && stages.length < 40) {
    // 1. The same thing on both pans comes off.
    for (let i = 0; i < scales.length; i++) {
      if (i === open || finished[i]) continue;
      const { left, right } = scales[i];
      const removed: Pan = { s: left.s.map((c, j) => Math.min(c, right.s[j])), k: Math.min(left.k, right.k) };
      if (removed.k === 0 && symCount(removed) === 0) continue;
      const next = cloneScales(scales);
      for (const p of [next[i].left, next[i].right]) {
        p.k -= removed.k;
        p.s = p.s.map((c, j) => c - removed.s[j]);
      }
      push({ op: "remove", focus: i, removed }, next);
      continue outer;
    }
    // 2. k copies of one symbol against something that splits into k equal parts.
    for (let i = 0; i < scales.length; i++) {
      if (i === open || finished[i]) continue;
      for (const symLeft of [true, false]) {
        const sc = scales[i];
        const [x, y] = symLeft ? [sc.left, sc.right] : [sc.right, sc.left];
        const l = lone(x);
        if (!l || y.s[l.sym] > 0 || y.k % l.times !== 0 || y.s.some((c) => c % l.times !== 0)) continue;
        const bare = symCount(y) === 0;
        if (l.times === 1 && !bare) continue;
        const next = cloneScales(scales);
        const [nx, ny] = symLeft ? [next[i].left, next[i].right] : [next[i].right, next[i].left];
        nx.s[l.sym] = 1;
        ny.k /= l.times;
        ny.s = ny.s.map((c) => c / l.times);
        if (bare) {
          known[l.sym] = ny.k;
          finished[i] = true;
        }
        push({ op: "divide", focus: i, sym: l.sym, times: l.times, symLeft }, next);
        continue outer;
      }
    }
    // 3. A symbol we know becomes a numbered block everywhere.
    for (let j = 0; j < n; j++) {
      const v = known[j];
      if (v === null || j === keep) continue;
      const targets = scales.map((_, i) => i).filter((i) => !finished[i] && has(scales[i], j));
      if (!targets.length) continue;
      const next = cloneScales(scales);
      for (const i of targets)
        for (const p of [next[i].left, next[i].right]) {
          p.k += p.s[j] * v;
          p.s[j] = 0;
        }
      push({ op: "value", sym: j, value: v, targets }, next);
      continue outer;
    }
    // 4. Substitute a definition (one symbol alone = other things), into the open scale first.
    const order = scales.map((_, i) => i).sort((a, b) => Number(b === open) - Number(a === open));
    for (let d = 0; d < scales.length; d++) {
      if (d === open || finished[d]) continue;
      for (const symLeft of [true, false]) {
        const [x, y] = symLeft ? [scales[d].left, scales[d].right] : [scales[d].right, scales[d].left];
        const l = lone(x);
        if (!l || l.times !== 1 || l.sym === keep || y.s[l.sym] > 0 || symCount(y) === 0) continue;
        const t = order.find((i) => i !== d && !finished[i] && has(scales[i], l.sym) && !(i !== open && isDefinitionOf(scales[i], l.sym)));
        if (t === undefined) continue;
        const next = cloneScales(scales);
        for (const p of [next[t].left, next[t].right]) {
          const c = p.s[l.sym];
          p.s[l.sym] = 0;
          p.k += c * y.k;
          p.s = p.s.map((v, j) => v + c * y.s[j]);
        }
        push({ op: "define", sym: l.sym, from: d, focus: t, expr: clonePan(y) }, next);
        continue outer;
      }
    }
    break;
  }
  return { stages, known, scales };
}

/** The scale is "sym = something" (so substituting another definition of sym into it is pointless). */
function isDefinitionOf(sc: Scale, sym: number) {
  return [sc.left, sc.right].some((p) => {
    const l = lone(p);
    return l !== null && l.sym === sym && l.times === 1;
  });
}

/** Stages for a balance or fill question. */
export function stagesOf(q: BalanceQuestion | FillQuestion) {
  if (q.type === "balance") return solveSteps(q.scales, q.n, (_, known) => known[q.ask] !== null);
  const scales = [...q.scales, { left: q.target, right: emptyPan(q.n) }];
  const open = scales.length - 1;
  const keep = q.fillWith ?? -1;
  return solveSteps(scales, q.n, (ss) => ss[open].left.s.every((c, j) => c === 0 || j === keep), open, keep);
}

/** The solver reaches the answer. */
function solved(q: BalanceQuestion | FillQuestion) {
  const r = stagesOf(q);
  if (q.type === "balance") return r.known[q.ask] === q.answer;
  const last = r.scales[r.scales.length - 1].left;
  return q.fillWith === null ? last.k === q.answer && symCount(last) === 0 : last.k === 0 && last.s[q.fillWith] === q.answer;
}

// ── Counterfeit coin ────────────────────────────────────────────────────

/** One weighing: coins [a0, a1) on the left pan, [b0, b1) on the right, [c0, c1) kept off. */
export interface Weighing {
  from: number;
  to: number;
  a: [number, number];
  b: [number, number];
  c: [number, number];
  /** +1: the right pan goes down; −1: the left; 0: level. */
  tilt: -1 | 0 | 1;
}

/** Split the suspects into three groups (two equal on the pans, the rest off) until one is left. */
export function coinWeighings(n: number, fake: number, heavy: boolean): Weighing[] {
  const out: Weighing[] = [];
  let [lo, hi] = [0, n];
  while (hi - lo > 1) {
    const a = Math.ceil((hi - lo) / 3);
    const A: [number, number] = [lo, lo + a];
    const B: [number, number] = [lo + a, lo + 2 * a];
    const C: [number, number] = [lo + 2 * a, hi];
    const inA = fake >= A[0] && fake < A[1];
    const inB = fake >= B[0] && fake < B[1];
    // A heavy fake pulls its pan down; a light one lets it rise.
    const tilt: -1 | 0 | 1 = inA ? (heavy ? -1 : 1) : inB ? (heavy ? 1 : -1) : 0;
    out.push({ from: lo, to: hi, a: A, b: B, c: C, tilt });
    [lo, hi] = inA ? A : inB ? B : C;
  }
  return out;
}

// ── Slips ───────────────────────────────────────────────────────────────

export type BalanceTag =
  | "right"
  | "oneSide"
  | "noSubtract"
  | "noDivide"
  | "otherSymbol"
  | "noWeight"
  | "count"
  | "forgotOnes"
  | "lucky"
  | "halves"
  | "boundary"
  | "pairs"
  | "allButOne"
  | "times"
  | "otherPerson"
  | "half"
  | "noHalf"
  | "wrongParts"
  | "later"
  | "other";

/** Wrong answers with a known cause, in the order they are checked. */
export function slips(q: BalanceQ): [BalanceTag, number][] {
  const out: [BalanceTag, number][] = [];
  switch (q.type) {
    case "balance": {
      if (q.n === 1) {
        const sc = q.scales[0];
        const [A, B] = sc.left.s[0] > sc.right.s[0] ? [sc.left, sc.right] : [sc.right, sc.left];
        const [a, c, b, d] = [A.s[0], B.s[0], A.k, B.k];
        if (c > 0) out.push(["oneSide", (d - b) / a]);
        if (b > 0) out.push(["noSubtract", d / (a - c)]);
        if (a - c > 1) out.push(["noDivide", (a - c) * q.answer]);
      } else {
        for (const s of stagesOf(q).stages) if (s.step.op === "divide" && s.step.sym === q.ask && s.step.times > 1) out.push(["noDivide", s.step.times * q.answer]);
        q.weights.forEach((v, j) => j !== q.ask && out.push(["otherSymbol", v]));
      }
      break;
    }
    case "fill": {
      if (q.target.k > 0) out.push(["noWeight", q.answer - q.target.k]);
      out.push(["count", symCount(q.target)]);
      if (q.fillWith !== null && q.target.s[q.fillWith] > 0) out.push(["forgotOnes", q.answer - q.target.s[q.fillWith]]);
      break;
    }
    case "coin": {
      if (q.variant === "min") {
        out.push(["lucky", 1]);
        out.push(["halves", Math.ceil(Math.log2(q.n) - 1e-9)]);
        if (3 ** minWeighings(q.n) === q.n) out.push(["boundary", q.answer + 1]);
        out.push(["pairs", Math.floor(q.n / 2)]);
        out.push(["allButOne", q.n - 1]);
      } else {
        out.push(["halves", 2 ** q.k]);
        out.push(["times", 3 * q.k]);
      }
      break;
    }
    case "age": {
      out.push(["otherPerson", q.askOlder ? q.young : q.old]);
      if (q.variant === "sumDiff") {
        const sum = q.young + q.old;
        out.push(["half", sum / 2]);
        out.push(["noHalf", sum - (q.old - q.young)]);
      } else if (q.variant === "timesSum" && !q.askOlder) out.push(["wrongParts", (q.young + q.old) / q.times]);
      else if (q.variant === "timesDiff" && !q.askOlder) out.push(["wrongParts", (q.old - q.young) / q.times]);
      else if (q.variant === "later") out.push(["later", q.answer + q.years]);
      break;
    }
  }
  return out.filter(([, v]) => Number.isInteger(v) && v > 0);
}

/** Which slip an answer is, if any. */
export function balanceMistake(q: BalanceQ, value: number): BalanceTag {
  if (value === q.answer) return "right";
  for (const [tag, v] of slips(q)) if (v !== q.answer && v === value) return tag;
  return "other";
}

/** Blocks for a total, biggest first (to show a filled pan). */
export function blocksFor(total: number): number[] {
  const out: number[] = [];
  let r = total;
  for (const b of [...BLOCKS].reverse())
    while (r >= b) {
      out.push(b);
      r -= b;
    }
  return out;
}
