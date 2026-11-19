// Tool 9: sequences. A rule builds the terms and a question hides one of them
// (the last, or one in the middle; never the first). Every question is checked
// against all the rule families the tool teaches, so the hidden term has only
// one answer. Letter sequences use places in the Persian alphabet (ا = 1 …
// ی = 32). Each question keeps the usual slips, so the feedback can say which
// slip a wrong answer was.

import { mulberry32, pick, randInt, type Rng } from "./random";

export type Level = 1 | 2 | 3;
export type SequenceKind = "arithmetic" | "geometric" | "alternate" | "second" | "additive" | "letters";
/** "mixed" follows the levels of the plan: 1 arithmetic, 2 geometric or alternating, 3 second-order or additive. */
export type SequenceQuestionType = SequenceKind | "mixed";
export type BlankChoice = "auto" | "last" | "mid";

export interface SequenceOptions {
  blank?: BlankChoice;
  /** Larger numbers. Letter sequences ignore it. */
  big?: boolean;
}

/** The 32 letters of the Persian alphabet, in school order. */
export const ALPHABET = ["ا", "ب", "پ", "ت", "ث", "ج", "چ", "ح", "خ", "د", "ذ", "ر", "ز", "ژ", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ک", "گ", "ل", "م", "ن", "و", "ه", "ی"];
/** Letter at a place 1 … 32. */
export const letterAt = (p: number) => ALPHABET[p - 1] ?? "؟";

export type Op = "+" | "×" | "÷";
/** One strand of a rule: start, then the same step each time ("+" may step down). */
export interface Strand {
  start: number;
  op: Op;
  by: number;
}

export type Rule =
  | ({ kind: "step" } & Strand)
  /** Differences first, first + growth, first + 2·growth, … */
  | { kind: "grow"; start: number; first: number; growth: number }
  /** Each term is the sum of the two before it. */
  | { kind: "sum2"; a: number; b: number }
  /** Two strands woven together: a at places 1, 3, 5, …; b at places 2, 4, 6, … */
  | { kind: "alt"; a: Strand; b: Strand };

export const applyOp = (v: number, op: Op, by: number) => (op === "+" ? v + by : op === "×" ? v * by : v / by);

/** The first n terms of a rule. */
export function termsOf(rule: Rule, n: number): number[] {
  const t: number[] = [];
  for (let k = 0; k < n; k++) {
    switch (rule.kind) {
      case "step":
        t.push(k ? applyOp(t[k - 1], rule.op, rule.by) : rule.start);
        break;
      case "grow":
        t.push(k ? t[k - 1] + rule.first + (k - 1) * rule.growth : rule.start);
        break;
      case "sum2":
        t.push(k === 0 ? rule.a : k === 1 ? rule.b : t[k - 1] + t[k - 2]);
        break;
      case "alt": {
        const s = k % 2 === 0 ? rule.a : rule.b;
        t.push(k < 2 ? s.start : applyOp(t[k - 2], s.op, s.by));
        break;
      }
    }
  }
  return t;
}

export const diffsOf = (s: number[]) => s.slice(1).map((v, k) => v - s[k]);
export const strandsOf = <T>(s: T[]): [T[], T[]] => [s.filter((_, k) => k % 2 === 0), s.filter((_, k) => k % 2 === 1)];

// ── Families: does a whole sequence follow one? ─────────────────────────────

const allSame = (s: number[]) => s.every((v) => v === s[0]);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export const isArithmetic = (s: number[]) => s.length >= 2 && allSame(diffsOf(s));
export function isGeometric(s: number[]) {
  if (s.length < 2 || s.some((v) => v === 0)) return false;
  const r = s[1] / s[0];
  return r > 0 && !near(r, 1) && s.every((v, k) => k === 0 || near(v, s[k - 1] * r));
}
export const isSecondOrder = (s: number[]) => s.length >= 3 && allSame(diffsOf(diffsOf(s)));
export const isAdditive = (s: number[]) => s.length >= 3 && s.every((v, k) => k < 2 || v === s[k - 1] + s[k - 2]);
/** Both strands arithmetic or geometric, with at least four terms each. */
export const isAlternate = (s: number[]) => s.length >= 8 && strandsOf(s).every((x) => isArithmetic(x) || isGeometric(x));

// ── What would each family put in the gap? ──────────────────────────────────

type Gap = (number | null)[];
const knownAt = (g: Gap) => g.flatMap((v, k) => (v === null ? [] : [k]));

function predictArithmetic(g: Gap, i: number) {
  const ks = knownAt(g);
  if (ks.length < 2) return null;
  const [p, q] = [ks[0], ks[ks.length - 1]];
  return g[p]! + ((i - p) * (g[q]! - g[p]!)) / (q - p);
}

function predictGeometric(g: Gap, i: number) {
  for (let p = 0; p + 1 < g.length; p++)
    if (g[p] !== null && g[p + 1] !== null && g[p] !== 0) return g[p]! * (g[p + 1]! / g[p]!) ** (i - p);
  return null;
}

/** Through the first three known terms (a constant second difference); needs a fourth to check. */
function predictSecondOrder(g: Gap, i: number) {
  const ks = knownAt(g);
  if (ks.length < 4) return null;
  const [a, b, c] = ks;
  const l = (x: number, y: number, z: number) => ((i - y) * (i - z)) / ((x - y) * (x - z));
  return g[a]! * l(a, b, c) + g[b]! * l(b, a, c) + g[c]! * l(c, a, b);
}

function predictAdditive(g: Gap, i: number) {
  if (i >= 2) return g[i - 1]! + g[i - 2]!;
  if (i + 2 < g.length) return g[i + 2]! - g[i + 1]!;
  return null;
}

/** The gap's own strand, read as arithmetic and as geometric; needs three known terms in it. */
function predictAlternate(g: Gap, i: number) {
  if (g.length < 8) return [];
  const own = strandsOf(g)[i % 2];
  if (own.filter((v) => v !== null).length < 3) return [];
  const j = Math.floor(i / 2);
  return [predictArithmetic(own, j), predictGeometric(own, j)];
}

/**
 * Every whole number that some family puts in the gap and that fits all the
 * other terms. A sound question has exactly one.
 */
export function candidates(terms: number[], blank: number): number[] {
  const g: Gap = terms.map((v, k) => (k === blank ? null : v));
  const tries: [number | null, (s: number[]) => boolean][] = [
    [predictArithmetic(g, blank), isArithmetic],
    [predictGeometric(g, blank), isGeometric],
    [predictSecondOrder(g, blank), isSecondOrder],
    [predictAdditive(g, blank), isAdditive],
    ...predictAlternate(g, blank).map((x): [number | null, (s: number[]) => boolean] => [x, isAlternate]),
  ];
  const out = new Set<number>();
  for (const [x, fits] of tries) {
    if (x === null || !Number.isFinite(x) || !near(x, Math.round(x))) continue;
    const v = Math.round(x);
    if (fits(terms.map((t, k) => (k === blank ? v : t)))) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
}

// ── Questions ───────────────────────────────────────────────────────────────

export interface SequenceQuestion {
  type: SequenceKind;
  level: Level;
  seed: number;
  rule: Rule;
  /** Terms are places in the alphabet, shown as letters. */
  letters: boolean;
  terms: number[];
  /** Index of the hidden term (never 0). */
  blank: number;
  answer: number;
}

/** Largest term allowed, by level; the number pad takes four digits. */
const CAP: Record<Level, [number, number]> = { 1: [200, 999], 2: [1000, 5000], 3: [3000, 9999] };

const between = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

interface Draft {
  rule: Rule;
  n: number;
  letters?: boolean;
}

function arithmetic(rng: Rng, level: Level, big: boolean): Draft {
  const n = level === 1 ? 5 : 6;
  const [dLo, dHi] = level === 1 ? (big ? [5, 25] : [2, 9]) : level === 2 ? (big ? [11, 45] : [3, 15]) : big ? [13, 99] : [7, 35];
  const d = between(rng, dLo, dHi);
  const down = level > 1 && rng() < (level === 2 ? 0.35 : 0.5);
  if (down) return { n, rule: { kind: "step", start: between(rng, 1, big ? 100 : 30) + (n - 1) * d, op: "+", by: -d } };
  const [sLo, sHi] = level === 1 ? (big ? [10, 99] : [1, 20]) : big ? [50, 300] : [5, level === 2 ? 60 : 150];
  const start = between(rng, sLo, sHi);
  return { n, rule: { kind: "step", start, op: "+", by: d } };
}

function geometric(rng: Rng, level: Level, big: boolean): Draft {
  const n = level === 3 ? 6 : 5;
  const down = level > 1 && rng() < (level === 2 ? 0.3 : 0.5);
  const by = level === 1 ? pick(rng, [2, 3]) : level === 2 ? pick(rng, down ? [2, 3] : [2, 3, 4, 5]) : pick(rng, down ? [2, 3] : [2, 3, 4]);
  const small = between(rng, 1, big ? 20 : level === 1 ? 5 : 6);
  // Going down, the smallest term is picked and the start worked out, so every term is whole.
  if (down) return { n, rule: { kind: "step", start: small * by ** (n - 1), op: "÷", by } };
  return { n, rule: { kind: "step", start: small, op: "×", by } };
}

function alternate(rng: Rng, level: Level, big: boolean, letters = false): Draft {
  const m = big ? 5 : 1;
  let a: Strand;
  let b: Strand;
  if (letters) {
    // One strand up from the start of the alphabet, one down from the end.
    a = { start: between(rng, 1, 8), op: "+", by: between(rng, 1, 3) };
    b = { start: between(rng, 25, 32), op: "+", by: -between(rng, 1, 2) };
  } else if (level === 1) {
    const da = between(rng, 1, 4);
    a = { start: between(rng, 1, 9) * m, op: "+", by: da * m };
    b = { start: between(rng, 10, 30) * m, op: "+", by: between(rng, 2, 6) * m };
  } else if (level === 2) {
    const db = between(rng, 1, 6) * m;
    a = { start: between(rng, 1, 15) * m, op: "+", by: between(rng, 2, 6) * m };
    b = { start: between(rng, 1, 20) * m + 3 * db, op: "+", by: -db };
  } else if (rng() < 0.5) {
    // One strand multiplies, the other adds or takes away.
    const r = pick(rng, [2, 3]);
    const g: Strand = { start: between(rng, 1, r === 2 ? 4 : 2) * m, op: "×", by: r };
    const d = between(rng, 2, 9) * m;
    const s: Strand = rng() < 0.5 ? { start: between(rng, 1, 30) * m, op: "+", by: d } : { start: between(rng, 1, 30) * m + 3 * d, op: "+", by: -d };
    [a, b] = rng() < 0.5 ? [g, s] : [s, g];
  } else {
    const db = between(rng, 2, 9) * m;
    a = { start: between(rng, 1, 40) * m, op: "+", by: between(rng, 3, 9) * m };
    b = { start: between(rng, 1, 40) * m + 3 * db, op: "+", by: -db };
  }
  return { n: 8, letters, rule: { kind: "alt", a, b } };
}

function second(rng: Rng, level: Level, big: boolean): Draft {
  const m = big ? 10 : 1;
  if (level === 1) return { n: 6, rule: { kind: "grow", start: between(rng, 1, 10) * m, first: between(rng, 1, 3), growth: 1 } };
  if (level === 2) return { n: 6, rule: { kind: "grow", start: between(rng, 1, 20) * m, first: between(rng, 1, 5), growth: between(rng, 2, 3) } };
  // The differences may start below zero: the terms dip, then rise.
  const first = pick(rng, [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
  return { n: 6, rule: { kind: "grow", start: between(rng, 1, 30) * m, first, growth: between(rng, 2, 5) } };
}

function additive(rng: Rng, level: Level, big: boolean): Draft {
  const [lo, hi] = level === 1 ? (big ? [5, 30] : [1, 6]) : level === 2 ? (big ? [10, 60] : [1, 12]) : big ? [20, 99] : [2, 20];
  return { n: level === 3 ? 7 : 6, rule: { kind: "sum2", a: between(rng, lo, hi), b: between(rng, lo, hi) } };
}

function letterDraft(rng: Rng, level: Level): Draft {
  if (level === 1) {
    const by = between(rng, 1, 3);
    return { n: 5, letters: true, rule: { kind: "step", start: between(rng, 1, 32 - 4 * by), op: "+", by } };
  }
  if (level === 2) {
    const by = between(rng, 2, 4);
    const start = between(rng, 1, 32 - 5 * by);
    return rng() < 0.35 ? { n: 6, letters: true, rule: { kind: "step", start: start + 5 * by, op: "+", by: -by } } : { n: 6, letters: true, rule: { kind: "step", start, op: "+", by } };
  }
  if (rng() < 0.5) return { n: 6, letters: true, rule: { kind: "grow", start: between(rng, 1, 10), first: between(rng, 1, 2), growth: 1 } };
  return alternate(rng, level, false, true);
}

/** In "mixed", the level picks the family. */
function kindFor(rng: Rng, level: Level): SequenceKind {
  if (level === 1) return rng() < 0.7 ? "arithmetic" : "letters";
  if (level === 2) {
    const r = rng();
    return r < 0.4 ? "geometric" : r < 0.8 ? "alternate" : "letters";
  }
  return rng() < 0.5 ? "second" : "additive";
}

function blankIndex(rng: Rng, n: number, level: Level, choice: BlankChoice) {
  const mid = choice === "mid" || (choice === "auto" && rng() < [0, 0.5, 0.7][level - 1]);
  return mid ? 1 + randInt(rng, n - 2) : n - 1;
}

export function makeSequenceQuestion(type: SequenceQuestionType, level: Level, seed: number, opts: SequenceOptions = {}): SequenceQuestion {
  const big = !!opts.big;
  const rng = mulberry32(seed * 7 + level * 101 + type.length * 13 + (big ? 4999 : 0));
  // A separate stream for the gap, so moving the gap keeps the same sequence where it can.
  const gapRng = mulberry32(seed * 31 + level * 17 + 3);
  const kind = type === "mixed" ? kindFor(rng, level) : type;
  const cap = CAP[level][big ? 1 : 0];
  for (;;) {
    const d: Draft =
      kind === "arithmetic"
        ? arithmetic(rng, level, big)
        : kind === "geometric"
          ? geometric(rng, level, big)
          : kind === "alternate"
            ? alternate(rng, level, big)
            : kind === "second"
              ? second(rng, level, big)
              : kind === "additive"
                ? additive(rng, level, big)
                : letterDraft(rng, level);
    const letters = !!d.letters;
    const terms = termsOf(d.rule, d.n);
    const [lo, hi] = letters ? [1, 32] : [1, cap];
    if (terms.some((t) => !Number.isInteger(t) || t < lo || t > hi)) continue;
    // Woven strands that happen to make one plain sequence teach nothing about weaving.
    if (d.rule.kind === "alt" && (isArithmetic(terms) || isGeometric(terms) || isSecondOrder(terms) || isAdditive(terms))) continue;
    const blank = blankIndex(gapRng, d.n, level, opts.blank ?? "auto");
    const answer = terms[blank];
    const c = candidates(terms, blank);
    if (c.length !== 1 || c[0] !== answer) continue;
    return { type: kind, level, seed, rule: d.rule, letters, terms, blank, answer };
  }
}

// ── Slips ───────────────────────────────────────────────────────────────────

export type SequenceTag = "right" | "offByOne" | "wrongWay" | "extraStep" | "addFactor" | "wrongStrand" | "double" | "secondOff" | "sameDiff" | "other";

/** Wrong answers with a known cause, in the order they are checked. */
export function slips(q: SequenceQuestion): [SequenceTag, number][] {
  const t = q.terms;
  const i = q.blank;
  const prev = t[i - 1];
  const r = q.rule;
  const out: [SequenceTag, number][] = [];
  // Letters: counting the start letter too, or missing one.
  if (q.letters) out.push(["offByOne", q.answer - 1], ["offByOne", q.answer + 1]);
  switch (r.kind) {
    case "step":
      if (r.op === "+")
        out.push(
          ["wrongWay", q.answer - 2 * r.by],
          ["extraStep", q.answer + r.by],
        );
      else out.push(["addFactor", r.op === "×" ? prev + r.by : prev - r.by]);
      break;
    case "grow":
      out.push(["secondOff", q.answer + r.growth], ["secondOff", q.answer - r.growth]);
      break;
    case "sum2":
      out.push(["double", 2 * prev]);
      break;
    case "alt": {
      // The neighbour belongs to the other strand; carrying its step on is the slip.
      const other = i % 2 === 0 ? r.b : r.a;
      out.push(["wrongStrand", applyOp(prev, other.op, other.by)]);
      break;
    }
  }
  // Reading it as one plain arithmetic sequence: the last difference again, or halfway between the neighbours.
  if (i >= 2) out.push(["sameDiff", 2 * prev - t[i - 2]]);
  if (i < t.length - 1) out.push(["sameDiff", (prev + t[i + 1]) / 2]);
  return out.filter(([, v]) => Number.isInteger(v));
}

/** Which slip an answer is, if any. */
export function sequenceMistake(q: SequenceQuestion, value: number): SequenceTag {
  if (value === q.answer) return "right";
  for (const [tag, v] of slips(q)) if (v !== q.answer && v === value) return tag;
  return "other";
}
